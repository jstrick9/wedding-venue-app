import { describe, expect, it } from 'vitest';
import type { PlatformOrganizationSummary } from '../services/platform/platformTypes';
import { filterPlatformVenues, listVenueRegions, venueRegionLabel } from './platformVenueFilters';

function org(over: Partial<PlatformOrganizationSummary> = {}): PlatformOrganizationSummary {
  return {
    id: 'org-1',
    name: 'Seven Paths Manor',
    slug: 'seven-paths-manor',
    status: 'active',
    city: 'Charlotte',
    stateRegion: 'NC',
    country: 'US',
    addressLine1: '100 Manor Rd',
    primaryContactName: 'Ada',
    primaryContactEmail: 'ada@sevenpaths.com',
    primaryContactPhone: '704-555-0100',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    admins: [],
    ...over,
  };
}

describe('platform venue filters', () => {
  const venues = [
    org(),
    org({
      id: 'org-2',
      name: 'Hilltop Barn',
      slug: 'hilltop-barn',
      status: 'provisioning',
      city: 'Asheville',
      stateRegion: 'NC',
      primaryContactName: 'Owen',
      primaryContactEmail: 'owner@hilltop.com',
      primaryContactPhone: '828-555-0100',
    }),
    org({
      id: 'org-3',
      name: 'Lakeside Chapel',
      slug: 'lakeside-chapel',
      status: 'suspended',
      city: 'Austin',
      stateRegion: 'TX',
      country: 'US',
      primaryContactName: 'Lila',
      primaryContactEmail: 'lila@lakeside.com',
      primaryContactPhone: '512-555-0100',
    }),
  ];

  it('searches name, city, slug, and contact email', () => {
    expect(filterPlatformVenues(venues, { query: 'manor' }).map((v) => v.id)).toEqual(['org-1']);
    expect(filterPlatformVenues(venues, { query: 'asheville' }).map((v) => v.id)).toEqual(['org-2']);
    expect(filterPlatformVenues(venues, { query: 'hilltop-barn' }).map((v) => v.id)).toEqual(['org-2']);
    expect(filterPlatformVenues(venues, { query: 'ada@sevenpaths.com' }).map((v) => v.id)).toEqual(['org-1']);
  });

  it('filters by status and region', () => {
    expect(filterPlatformVenues(venues, { status: 'suspended' })).toHaveLength(1);
    expect(filterPlatformVenues(venues, { region: 'TX, US' }).map((v) => v.id)).toEqual(['org-3']);
    expect(filterPlatformVenues(venues, { status: 'active', region: 'NC, US' }).map((v) => v.id)).toEqual(['org-1']);
  });

  it('lists unique region labels', () => {
    expect(venueRegionLabel(venues[0])).toBe('NC, US');
    expect(listVenueRegions(venues)).toEqual(['NC, US', 'TX, US']);
  });
});
