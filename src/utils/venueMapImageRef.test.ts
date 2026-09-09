import { describe, expect, it } from 'vitest';
import { emptyVenueMapConfig } from '../services/wayfinding/venueWayfindingService';
import { projectVenueMap } from './venueMapDesigner';
import { isManagedVenueMapImageRef } from './venueMapImageRef';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222';
const MANAGED_REF = `sp://venue-map-images/${ORG_ID}/1700000000000-property.png`;

describe('venue-map managed base-image references', () => {
  it('accepts only private map-bucket objects in the active organization folder', () => {
    expect(isManagedVenueMapImageRef(MANAGED_REF, ORG_ID)).toBe(true);
    expect(isManagedVenueMapImageRef(MANAGED_REF, OTHER_ORG_ID)).toBe(false);
    expect(isManagedVenueMapImageRef(`sp://venue-images/${ORG_ID}/property.png`, ORG_ID)).toBe(false);
    expect(isManagedVenueMapImageRef('https://cdn.example.test/property.png', ORG_ID)).toBe(false);
    expect(isManagedVenueMapImageRef('data:image/png;base64,AA==', ORG_ID)).toBe(false);
    expect(isManagedVenueMapImageRef(`sp://venue-map-images/${ORG_ID}/`, ORG_ID)).toBe(false);
    expect(isManagedVenueMapImageRef(`sp://venue-map-images/${ORG_ID}/map.png?token=copy`, ORG_ID)).toBe(false);
  });

  it('removes unmanaged images only when a managed-only portal projection is requested', () => {
    const localMap = {
      ...emptyVenueMapConfig(),
      backgroundImageUrl: 'data:image/png;base64,AA==',
      backgroundOpacity: 0.7,
    };

    expect(projectVenueMap(localMap, 'couple').backgroundImageUrl)
      .toBe('data:image/png;base64,AA==');
    expect(projectVenueMap(
      localMap,
      'couple',
      undefined,
      { managedBaseImageOnly: true },
    )).toMatchObject({
      backgroundImageUrl: undefined,
      backgroundOpacity: undefined,
      backgroundImageUnavailable: true,
    });

    const managedMap = { ...localMap, backgroundImageUrl: MANAGED_REF };
    expect(projectVenueMap(
      managedMap,
      'guest',
      [],
      { managedBaseImageOnly: true },
    ).backgroundImageUrl).toBe(MANAGED_REF);
  });
});
