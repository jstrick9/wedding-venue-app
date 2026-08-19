/**
 * Map Geoapify geocoding / autocomplete results onto the venue address shape.
 * A result is "verified" only when it is a street-level US address with
 * house number, street, city, state, and postal code.
 */
export interface GeoapifyRank {
  confidence?: number;
  confidence_city_level?: number;
  confidence_street_level?: number;
  confidence_building_level?: number;
  match_type?: string;
}

export interface GeoapifyResult {
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  state_code?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  result_type?: string;
  lat?: number;
  lon?: number;
  place_id?: string;
  rank?: GeoapifyRank;
}

export interface StandardizedAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  formatted: string;
  placeId: string;
  resultType: string;
  confidence: number;
  verified: boolean;
}

const VERIFIED_MATCH_TYPES = new Set([
  'full_match',
  'inner_part',
  'match_by_building',
]);

export function composeStreetLine(result: GeoapifyResult): string {
  return [result.housenumber, result.street].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
}

export function resolveCity(result: GeoapifyResult): string {
  return String(result.city || result.town || result.village || '').trim();
}

export function isVerifiedStreetAddress(result: GeoapifyResult): boolean {
  const street = composeStreetLine(result);
  const city = resolveCity(result);
  const state = String(result.state_code || result.state || '').trim();
  const postal = String(result.postcode || '').trim();
  const country = String(result.country_code || 'us').trim().toLowerCase();
  if (country && country !== 'us') return false;
  if (!street || !city || !state || !postal) return false;
  if (!result.housenumber || !result.street) return false;
  const type = String(result.result_type || '');
  if (type === 'city' || type === 'postcode' || type === 'state' || type === 'county' || type === 'country') {
    return false;
  }
  const confidence = Number(result.rank?.confidence ?? 0);
  const matchType = String(result.rank?.match_type || '');
  if (VERIFIED_MATCH_TYPES.has(matchType)) return true;
  if (type === 'building' || type === 'amenity') return confidence >= 0.4 || Number(result.rank?.confidence_building_level ?? 0) >= 0.5;
  return confidence >= 0.6;
}

export function mapGeoapifyResult(result: GeoapifyResult | null | undefined): StandardizedAddress | null {
  if (!result) return null;
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const addressLine1 = composeStreetLine(result);
  const city = resolveCity(result);
  const stateRegion = String(result.state_code || '').trim().toUpperCase() || String(result.state || '').trim();
  const postalCode = String(result.postcode || '').trim();
  const verified = isVerifiedStreetAddress(result);
  return {
    addressLine1,
    addressLine2: '',
    city,
    stateRegion,
    postalCode,
    country: 'US',
    latitude,
    longitude,
    formatted: String(result.formatted || [addressLine1, city, stateRegion, postalCode].filter(Boolean).join(', ')),
    placeId: String(result.place_id || ''),
    resultType: String(result.result_type || ''),
    confidence: Number(result.rank?.confidence ?? 0),
    verified,
  };
}

export function suggestionLabel(address: StandardizedAddress): string {
  return address.formatted || [address.addressLine1, address.city, address.stateRegion, address.postalCode].filter(Boolean).join(', ');
}
