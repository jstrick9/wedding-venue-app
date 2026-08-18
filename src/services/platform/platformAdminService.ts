import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import { createOpaqueToken } from '../../utils/secureTokens';
import type { PlatformOrganizationSummary } from './platformTypes';

export interface CreateVenueOrganizationInput {
  name: string;
  slug?: string;
  adminEmail: string;
  expiresAt?: string;
}

export interface CreateVenueOrganizationResult {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  expiresAt: string;
  inviteUrl: string;
}

function requireSupabase(): ReturnType<typeof getSupabaseClient> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }
  return getSupabaseClient();
}

function appBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}`;
}

export function buildVenueAdminInviteUrl(token: string): string {
  return `${appBaseUrl()}#/venue-onboarding?token=${encodeURIComponent(token)}`;
}

export async function listPlatformOrganizations(): Promise<PlatformOrganizationSummary[]> {
  const supabase = requireSupabase();
  const [{ data: organizations, error: organizationsError }, { data: memberships, error: membershipsError }, { data: profiles, error: profilesError }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id,name,slug,owner_id,support_email,phone,website_url,created_at,updated_at')
      .order('created_at', { ascending: true }),
    supabase
      .from('organization_memberships')
      .select('organization_id,user_id,role,status')
      .in('role', ['owner', 'admin']),
    supabase
      .from('profiles')
      .select('id,email,full_name'),
  ]);

  if (organizationsError) throw organizationsError;
  if (membershipsError) throw membershipsError;
  if (profilesError) throw profilesError;

  const profileById = new Map(
    (profiles || []).map((profile) => [profile.id, profile]),
  );

  return (organizations || []).map((organization) => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    ownerId: organization.owner_id,
    supportEmail: organization.support_email,
    phone: organization.phone,
    websiteUrl: organization.website_url,
    createdAt: organization.created_at,
    updatedAt: organization.updated_at,
    admins: (memberships || [])
      .filter((membership) => membership.organization_id === organization.id)
      .map((membership) => {
        const profile = profileById.get(membership.user_id);
        return {
          userId: membership.user_id,
          email: profile?.email || '',
          fullName: profile?.full_name || profile?.email || 'Venue admin',
          role: membership.role,
          status: membership.status,
        };
      }),
  }));
}

export async function createVenueOrganization(
  input: CreateVenueOrganizationInput,
): Promise<CreateVenueOrganizationResult> {
  const supabase = requireSupabase();
  const token = createOpaqueToken('va');
  const expiresAt = input.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase.rpc('create_venue_organization', {
    p_name: input.name.trim(),
    p_slug: input.slug?.trim() || '',
    p_admin_email: input.adminEmail.trim().toLowerCase(),
    p_admin_token: token,
    p_expires_at: expiresAt,
  });

  if (error) throw error;
  if (!data?.ok) {
    throw new Error(String(data?.error || 'Could not create the venue organization.'));
  }

  return {
    organizationId: String(data.organization_id),
    organizationName: String(data.organization_name),
    organizationSlug: String(data.organization_slug),
    expiresAt: String(data.expires_at || expiresAt),
    inviteUrl: buildVenueAdminInviteUrl(token),
  };
}

export async function acceptVenueAdminInvite(token: string): Promise<{ organizationId: string; organizationName: string }> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('accept_venue_admin_invite', {
    p_token: token,
  });
  if (error) throw error;
  if (!data?.ok) {
    throw new Error(String(data?.error || 'Could not accept the venue administrator invitation.'));
  }
  return {
    organizationId: String(data.organization_id),
    organizationName: String(data.organization_name),
  };
}
