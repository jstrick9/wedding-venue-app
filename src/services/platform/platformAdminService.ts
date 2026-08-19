import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import { createOpaqueToken } from '../../utils/secureTokens';
import type {
  PlatformConsoleMetrics,
  PlatformOrganizationSummary,
} from './platformTypes';

export interface CreateVenueOrganizationInput {
  name: string;
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

export interface VenueAdminInviteContext {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  email: string;
  role: string;
  expiresAt: string;
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
  const [organizationsResult, membershipsResult, profilesResult, invitesResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id,name,slug,status,owner_id,support_email,phone,website_url,suspension_reason,created_at,updated_at')
      .order('created_at', { ascending: true }),
    supabase
      .from('organization_memberships')
      .select('organization_id,user_id,role,status')
      .in('role', ['owner', 'admin']),
    supabase
      .from('profiles')
      .select('id,email,full_name'),
    supabase
      .from('venue_admin_invites')
      .select('id,organization_id,email,expires_at,status')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ]);

  if (organizationsResult.error) throw organizationsResult.error;
  if (membershipsResult.error) throw membershipsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (invitesResult.error) throw invitesResult.error;

  const profileById = new Map(
    (profilesResult.data || []).map((profile) => [profile.id, profile]),
  );
  const pendingInviteByOrg = new Map<string, PlatformOrganizationSummary['pendingInvite']>();
  for (const invite of invitesResult.data || []) {
    if (!pendingInviteByOrg.has(invite.organization_id)) {
      pendingInviteByOrg.set(invite.organization_id, {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expires_at,
        status: invite.status,
      });
    }
  }

  return (organizationsResult.data || []).map((organization) => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: (organization.status || 'active') as PlatformOrganizationSummary['status'],
    ownerId: organization.owner_id,
    supportEmail: organization.support_email,
    phone: organization.phone,
    websiteUrl: organization.website_url,
    suspensionReason: organization.suspension_reason,
    createdAt: organization.created_at,
    updatedAt: organization.updated_at,
    pendingInvite: pendingInviteByOrg.get(organization.id),
    admins: (membershipsResult.data || [])
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

export async function getPlatformConsoleMetrics(): Promise<PlatformConsoleMetrics> {
  const { data, error } = await requireSupabase().rpc('get_platform_console_metrics');
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not load platform metrics.'));
  const global = data.global || {};
  return {
    totalVenues: Number(global.total_venues || 0),
    activeVenues: Number(global.active_venues || 0),
    suspendedVenues: Number(global.suspended_venues || 0),
    provisioningVenues: Number(global.provisioning_venues || 0),
    pendingInvites: Number(global.pending_invites || 0),
    activeAdmins: Number(global.active_admins || 0),
    totalCouples: Number(global.total_couples || 0),
    totalGuests: Number(global.total_guests || 0),
    totalRsvps: Number(global.total_rsvps || 0),
    venues: Array.isArray(data.venues)
      ? data.venues.map((venue: Record<string, unknown>) => ({
          id: String(venue.id),
          name: String(venue.name),
          slug: String(venue.slug),
          status: String(venue.status || 'active') as PlatformConsoleMetrics['venues'][number]['status'],
          createdAt: String(venue.created_at),
          adminCount: Number(venue.admin_count || 0),
          coupleCount: Number(venue.couple_count || 0),
          guestCount: Number(venue.guest_count || 0),
          rsvpCount: Number(venue.rsvp_count || 0),
          pendingInviteCount: Number(venue.pending_invite_count || 0),
        }))
      : [],
  };
}

export async function createVenueOrganization(
  input: CreateVenueOrganizationInput,
): Promise<CreateVenueOrganizationResult> {
  const supabase = requireSupabase();
  const token = createOpaqueToken('va');
  const expiresAt = input.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase.rpc('create_venue_organization', {
    p_name: input.name.trim(),
    // The database now generates and freezes the slug from the venue name.
    p_slug: '',
    p_admin_email: input.adminEmail.trim().toLowerCase(),
    p_admin_token: token,
    p_expires_at: expiresAt,
  });

  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not create the venue organization.'));

  return {
    organizationId: String(data.organization_id),
    organizationName: String(data.organization_name),
    organizationSlug: String(data.organization_slug),
    expiresAt: String(data.expires_at || expiresAt),
    inviteUrl: buildVenueAdminInviteUrl(token),
  };
}

export async function getVenueAdminInviteContext(token: string): Promise<VenueAdminInviteContext | null> {
  const { data, error } = await requireSupabase().rpc('get_venue_admin_invite_context', { p_token: token });
  if (error || !data?.ok) return null;
  return {
    organizationId: String(data.organization_id),
    organizationName: String(data.organization_name),
    organizationSlug: String(data.organization_slug),
    email: String(data.email),
    role: String(data.role),
    expiresAt: String(data.expires_at),
  };
}

export async function reissueVenueAdminInvite(
  organizationId: string,
  email: string,
): Promise<{ inviteUrl: string; expiresAt: string }> {
  const token = createOpaqueToken('va');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await requireSupabase().rpc('reissue_venue_admin_invite', {
    p_organization_id: organizationId,
    p_email: email.trim().toLowerCase(),
    p_admin_token: token,
    p_expires_at: expiresAt,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not reissue the venue administrator invite.'));
  return { inviteUrl: buildVenueAdminInviteUrl(token), expiresAt: String(data.expires_at || expiresAt) };
}

export async function revokeVenueAdminInvite(inviteId: string, reason?: string): Promise<void> {
  const { data, error } = await requireSupabase().rpc('revoke_venue_admin_invite', {
    p_invite_id: inviteId,
    p_reason: reason || null,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not revoke the venue administrator invite.'));
}

export async function suspendVenueOrganization(organizationId: string, reason?: string): Promise<void> {
  const { data, error } = await requireSupabase().rpc('suspend_venue_organization', {
    p_organization_id: organizationId,
    p_reason: reason || null,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not suspend the venue.'));
}

export async function reactivateVenueOrganization(organizationId: string): Promise<void> {
  const { data, error } = await requireSupabase().rpc('reactivate_venue_organization', {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not reactivate the venue.'));
}

export async function acceptVenueAdminInvite(token: string): Promise<{ organizationId: string; organizationName: string; organizationSlug?: string }> {
  const { data, error } = await requireSupabase().rpc('accept_venue_admin_invite', { p_token: token });
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not accept the venue administrator invitation.'));
  return { organizationId: String(data.organization_id), organizationName: String(data.organization_name), organizationSlug: data.organization_slug ? String(data.organization_slug) : undefined };
}
