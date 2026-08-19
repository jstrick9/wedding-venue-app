import type { OrganizationStatus, PlatformOrganizationSummary } from '../services/platform/platformTypes';

export interface PlatformVenueFilter {
  query?: string;
  status?: OrganizationStatus | 'all';
  region?: string;
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

export function filterPlatformVenues(
  organizations: PlatformOrganizationSummary[],
  filter: PlatformVenueFilter = {},
): PlatformOrganizationSummary[] {
  const query = (filter.query || '').trim().toLowerCase();
  const status = filter.status && filter.status !== 'all' ? filter.status : null;
  const region = (filter.region || '').trim();

  return organizations.filter((organization) => {
    if (status && organization.status !== status) return false;
    if (region && venueRegionLabel(organization) !== region) return false;
    if (query && !haystack(organization).includes(query)) return false;
    return true;
  });
}
