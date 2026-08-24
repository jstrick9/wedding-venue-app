import type { AuthSurface } from '../../utils/authSurface';
import { getSupabaseClient, isSupabaseConfigured, requirePlatformClient } from '../backend/supabaseClient';
import { createOpaqueToken } from '../../utils/secureTokens';
import { normalizeEmail, normalizeUsPhone, normalizeWebsite } from '../../utils/contactQuality';
import { buildVenueAdminInviteUrl, sanitizeVenueAdminToken } from '../../utils/venueAdminInviteRoute';
import { DEFAULT_NEW_INVITE_TTL_DAYS, DEFAULT_REISSUE_INVITE_TTL_DAYS, inviteExpiresAt } from '../../utils/inviteTtl';
import type {
  OrganizationStatus,
  PlatformAuditLogEntry,
  PlatformConsoleMetrics,
  PlatformOrganizationSummary,
} from './platformTypes';

export interface CreateVenueOrganizationInput {
  name: string;
  adminEmail: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
  latitude: number;
  longitude: number;
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

function describePlatformRpcFailure(error: string, fallback: string): string {
  const message = error.trim();
  if (/^forbidden$/i.test(message)) {
    return 'This action requires the platform administrator login. Sign in again at Platform login. A venue invite account in this browser is separate and cannot change venue records.';
  }
  if (/could not find the function|schema cache|PGRST202/i.test(message)) {
    return 'The venue update function is missing. In Supabase → SQL Editor, run supabase/migrations/0014_geoapify_address_quality.sql.';
  }
  return message || fallback;
}

async function requireSupabase(surface: AuthSurface = 'platform'): Promise<ReturnType<typeof getSupabaseClient>> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }
  if (surface === 'platform') return requirePlatformClient();
  return getSupabaseClient(surface);
}

export { buildVenueAdminInviteUrl } from '../../utils/venueAdminInviteRoute';

export async function listPlatformOrganizations(): Promise<PlatformOrganizationSummary[]> {
  const supabase = await requireSupabase();
  const [organizationsResult, membershipsResult, profilesResult, invitesResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id,name,slug,status,owner_id,support_email,phone,website_url,address_line1,address_line2,city,state_region,postal_code,country,primary_contact_name,primary_contact_phone,primary_contact_email,latitude,longitude,suspension_reason,created_at,updated_at')
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
    addressLine1: organization.address_line1,
    addressLine2: organization.address_line2,
    city: organization.city,
    stateRegion: organization.state_region,
    postalCode: organization.postal_code,
    country: organization.country,
    primaryContactName: organization.primary_contact_name,
    primaryContactPhone: organization.primary_contact_phone,
    primaryContactEmail: organization.primary_contact_email,
    latitude: organization.latitude,
    longitude: organization.longitude,
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
  const { data, error } = await (await requireSupabase()).rpc('get_platform_console_metrics');
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
  const supabase = await requireSupabase();
  const token = createOpaqueToken('va');
  const expiresAt = input.expiresAt || inviteExpiresAt(DEFAULT_NEW_INVITE_TTL_DAYS);
  const adminEmail = normalizeEmail(input.adminEmail, { required: true });
  const contactEmail = normalizeEmail(input.primaryContactEmail, { required: true });
  const contactPhone = normalizeUsPhone(input.primaryContactPhone, { required: true });
  if (!adminEmail.ok) throw new Error(adminEmail.error);
  if (!contactEmail.ok) throw new Error(contactEmail.error);
  if (!contactPhone.ok) throw new Error(contactPhone.error);

  const { data, error } = await supabase.rpc('create_venue_organization_v2', {
    p_name: input.name.trim(),
    p_admin_email: adminEmail.value,
    p_admin_token: token,
    p_expires_at: expiresAt,
    p_address_line1: input.addressLine1.trim(),
    p_address_line2: input.addressLine2?.trim() || '',
    p_city: input.city.trim(),
    p_state_region: input.stateRegion.trim(),
    p_postal_code: input.postalCode.trim(),
    p_country: input.country.trim() || 'US',
    p_primary_contact_name: input.primaryContactName.trim(),
    p_primary_contact_phone: contactPhone.value,
    p_primary_contact_email: contactEmail.value,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
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

export async function lookupVenueAdminInvite(token: string): Promise<{ context: VenueAdminInviteContext | null; error?: string }> {
  const trimmed = sanitizeVenueAdminToken(token) || token.trim();
  if (!trimmed) return { context: null, error: 'missing' };
  const { data, error } = await (await requireSupabase('venue')).rpc('get_venue_admin_invite_context', { p_token: trimmed });
  if (error) return { context: null, error: error.message || 'not_found' };
  const payload = (typeof data === 'string'
    ? (() => { try { return JSON.parse(data) as Record<string, unknown>; } catch { return null; } })()
    : data) as Record<string, unknown> | null;
  if (!payload?.ok) return { context: null, error: String(payload?.error || 'not_found') };
  return {
    context: {
      organizationId: String(payload.organization_id),
      organizationName: String(payload.organization_name),
      organizationSlug: String(payload.organization_slug),
      email: String(payload.email),
      role: String(payload.role),
      expiresAt: String(payload.expires_at),
    },
  };
}

export async function getVenueAdminInviteContext(token: string): Promise<VenueAdminInviteContext | null> {
  const result = await lookupVenueAdminInvite(token);
  return result.context;
}

export async function reissueVenueAdminInvite(
  organizationId: string,
  email: string,
  expiresAt?: string,
): Promise<{ inviteUrl: string; expiresAt: string }> {
  const token = createOpaqueToken('va');
  const nextExpiry = expiresAt || inviteExpiresAt(DEFAULT_REISSUE_INVITE_TTL_DAYS);
  const { data, error } = await (await requireSupabase('platform')).rpc('reissue_venue_admin_invite', {
    p_organization_id: organizationId,
    p_email: email.trim().toLowerCase(),
    p_admin_token: token,
    p_expires_at: nextExpiry,
  });
  if (error) throw new Error(describePlatformRpcFailure(error.message || '', 'Could not reissue the venue administrator invite.'));
  if (!data?.ok) throw new Error(describePlatformRpcFailure(String(data?.error || ''), 'Could not reissue the venue administrator invite.'));
  return { inviteUrl: buildVenueAdminInviteUrl(token), expiresAt: String(data.expires_at || nextExpiry) };
}

export async function revokeVenueAdminInvite(inviteId: string, reason?: string): Promise<void> {
  const { data, error } = await (await requireSupabase()).rpc('revoke_venue_admin_invite', {
    p_invite_id: inviteId,
    p_reason: reason || null,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not revoke the venue administrator invite.'));
}

export async function suspendVenueOrganization(organizationId: string, reason?: string): Promise<void> {
  const { data, error } = await (await requireSupabase()).rpc('suspend_venue_organization', {
    p_organization_id: organizationId,
    p_reason: reason || null,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not suspend the venue.'));
}

export async function reactivateVenueOrganization(organizationId: string): Promise<void> {
  const { data, error } = await (await requireSupabase()).rpc('reactivate_venue_organization', {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not reactivate the venue.'));
}

export interface UpdateVenueOrganizationInput {
  organizationId: string;
  name: string;
  status: OrganizationStatus;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
  supportEmail?: string;
  phone?: string;
  websiteUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  suspensionReason?: string;
}

export async function updateVenueOrganization(
  input: UpdateVenueOrganizationInput,
): Promise<{ organizationId: string; organizationName: string; organizationSlug: string; status: OrganizationStatus }> {
  const website = normalizeWebsite(input.websiteUrl);
  if (!website.ok) throw new Error(website.error || 'Website URL must be an http or https address.');
  const contactEmail = normalizeEmail(input.primaryContactEmail, { required: true });
  const contactPhone = normalizeUsPhone(input.primaryContactPhone, { required: true });
  const supportEmail = normalizeEmail(input.supportEmail);
  const venuePhone = normalizeUsPhone(input.phone);
  if (!contactEmail.ok) throw new Error(contactEmail.error);
  if (!contactPhone.ok) throw new Error(contactPhone.error);
  if (!supportEmail.ok) throw new Error(supportEmail.error);
  if (!venuePhone.ok) throw new Error(venuePhone.error);
  const { data, error } = await (await requireSupabase()).rpc('update_venue_organization', {
    p_organization_id: input.organizationId,
    p_name: input.name.trim(),
    p_status: input.status,
    p_address_line1: input.addressLine1.trim(),
    p_address_line2: input.addressLine2?.trim() || '',
    p_city: input.city.trim(),
    p_state_region: input.stateRegion.trim(),
    p_postal_code: input.postalCode.trim(),
    p_country: input.country.trim() || 'US',
    p_primary_contact_name: input.primaryContactName.trim(),
    p_primary_contact_phone: contactPhone.value,
    p_primary_contact_email: contactEmail.value,
    p_support_email: supportEmail.value,
    p_phone: venuePhone.value,
    p_website_url: website.value,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_suspension_reason: input.suspensionReason?.trim() || null,
  });
  if (error) {
    throw new Error(describePlatformRpcFailure(error.message || '', 'Could not update the venue organization.'));
  }
  if (!data?.ok) {
    throw new Error(describePlatformRpcFailure(String(data?.error || ''), 'Could not update the venue organization.'));
  }
  return {
    organizationId: String(data.organization_id),
    organizationName: String(data.organization_name),
    organizationSlug: String(data.organization_slug),
    status: String(data.status || input.status) as OrganizationStatus,
  };
}

export async function listPlatformAuditLogs(limit = 100): Promise<PlatformAuditLogEntry[]> {
  const { data, error } = await (await requireSupabase())
    .from('platform_audit_logs')
    .select('id,platform_user_id,organization_id,action,target_type,target_id,reason,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.id),
    platformUserId: String(row.platform_user_id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    action: String(row.action),
    targetType: String(row.target_type),
    targetId: row.target_id ? String(row.target_id) : null,
    reason: row.reason ? String(row.reason) : null,
    metadata: (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
  }));
}

export async function acceptVenueAdminInvite(token: string): Promise<{ organizationId: string; organizationName: string; organizationSlug?: string }> {
  const { data, error } = await (await requireSupabase('venue')).rpc('accept_venue_admin_invite', { p_token: token });
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not accept the venue administrator invitation.'));
  return { organizationId: String(data.organization_id), organizationName: String(data.organization_name), organizationSlug: data.organization_slug ? String(data.organization_slug) : undefined };
}
