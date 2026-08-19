import { describe, expect, it } from 'vitest';
import { isVerifiedStreetAddress, mapGeoapifyResult } from './geoapifyAddress';

const whiteHouse = {
  formatted: 'White House, 1600 Pennsylvania Avenue Northwest, Washington, DC 20500, United States of America',
  housenumber: '1600',
  street: 'Pennsylvania Avenue Northwest',
  city: 'Washington',
  state_code: 'DC',
  postcode: '20500',
  country_code: 'us',
  result_type: 'amenity',
  lat: 38.8976387,
  lon: -77.0365528,
  place_id: 'place-1',
  rank: { confidence: 1, match_type: 'inner_part' },
};

describe('geoapifyAddress', () => {
  it('maps a building/amenity result onto street + city + state + ZIP', () => {
    const mapped = mapGeoapifyResult(whiteHouse);
    expect(mapped).toMatchObject({
      addressLine1: '1600 Pennsylvania Avenue Northwest',
      city: 'Washington',
      stateRegion: 'DC',
      postalCode: '20500',
      country: 'US',
      verified: true,
      latitude: 38.8976387,
      longitude: -77.0365528,
    });
  });

  it('rejects city-only and street-only results as unverified', () => {
    expect(isVerifiedStreetAddress({
      city: 'Spring Hope',
      state_code: 'NC',
      result_type: 'city',
      rank: { confidence: 0.25, match_type: 'match_by_city_or_disrict' },
    })).toBe(false);
    expect(isVerifiedStreetAddress({
      street: 'Seven Paths Road',
      state_code: 'NC',
      postcode: '27882',
      result_type: 'street',
      rank: { confidence: 0, match_type: 'match_by_street' },
    })).toBe(false);
  });

  it('returns null when coordinates are missing', () => {
    expect(mapGeoapifyResult({ ...whiteHouse, lat: undefined, lon: undefined })).toBeNull();
  });
});
