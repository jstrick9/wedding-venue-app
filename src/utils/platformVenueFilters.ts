import type { OrganizationStatus, PlatformOrganizationSummary } from '../services/platform/platformTypes';
import type { VenueQueueFilter } from './platformConsoleRoute';

export interface PlatformVenueFilter {
  query?: string;
  status?: OrganizationStatus | 'all';
  region?: string;
  queue?: VenueQueueFilter;
}

function haystack(organization: PlatformOrganizationSummary): string {
  return [
    organization.name,
    organization.slug,
    organization.city,
    organization.stateRegion,
    organization.country,
    organization.primaryContactName,
    organization.primaryContactEmail,
    organization.primaryContactPhone,
    organization.supportEmail,
    organization.phone,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function venueRegionLabel(organization: PlatformOrganizationSummary): string {
  return [organization.stateRegion, organization.country].filter(Boolean).join(', ') || 'Unknown';
}

export function listVenueRegions(organizations: PlatformOrganizationSummary[]): string[] {
  const regions = new Set<string>();
  for (const organization of organizations) {
    regions.add(venueRegionLabel(organization));
  }
  return [...regions].sort((a, b) => a.localeCompare(b));
}

export function isAwaitingAdmin(organization: PlatformOrganizationSummary): boolean {
  return organization.status === 'provisioning' || !organization.ownerId;
}

export function isInviteExpired(organization: PlatformOrganizationSummary, now = Date.now()): boolean {
  if (!organization.pendingInvite?.expiresAt) return false;
  const expires = Date.parse(organization.pendingInvite.expiresAt);
  return Number.isFinite(expires) && expires <= now;
}

export function isPendingInviteLive(organization: PlatformOrganizationSummary, now = Date.now()): boolean {
  return Boolean(organization.pendingInvite) && !isInviteExpired(organization, now);
}

export function filterPlatformVenues(
  organizations: PlatformOrganizationSummary[],
  filter: PlatformVenueFilter = {},
): PlatformOrganizationSummary[] {
  const query = (filter.query || '').trim().toLowerCase();
  const status = filter.status && filter.status !== 'all' ? filter.status : null;
  const region = (filter.region || '').trim();
  const queue = filter.queue && filter.queue !== 'all' ? filter.queue : null;

  return organizations.filter((organization) => {
    if (status && organization.status !== status) return false;
    if (region && venueRegionLabel(organization) !== region) return false;
    if (queue === 'awaiting-admin' && !isAwaitingAdmin(organization)) return false;
    if (queue === 'pending-invite' && !isPendingInviteLive(organization)) return false;
    if (queue === 'expired-invite' && !isInviteExpired(organization)) return false;
    if (query && !haystack(organization).includes(query)) return false;
    return true;
  });
}
