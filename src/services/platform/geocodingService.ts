import { getCurrentAccessToken, isSupabaseConfigured } from '../backend/supabaseClient';
import { mapGeoapifyResult, type StandardizedAddress } from '../../utils/geoapifyAddress';
import { normalizeUsPostalCode, normalizeUsState } from '../../utils/contactQuality';

export interface VenueAddressInput {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
}

export interface GeocodedAddress {
  latitude: number;
  longitude: number;
  displayName: string;
  provider: 'geoapify';
  placeId?: string;
  address?: StandardizedAddress;
}

const UNREACHABLE_ADDRESS_SERVICE =
  'Could not reach the address service. In the Supabase project: deploy the geocode-venue Edge Function, then set the GEOAPIFY_API_KEY secret.';

function requireSupabaseUrl(): string {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  return String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
}

function translateNetworkError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    throw new Error(UNREACHABLE_ADDRESS_SERVICE);
  }
  throw error instanceof Error ? error : new Error(message);
}

async function authorizedFetch(init: RequestInit): Promise<Response> {
  const accessToken = await getCurrentAccessToken('platform');
  if (!accessToken) throw new Error('Sign in as a platform administrator before looking up an address.');
  const url = `${requireSupabaseUrl()}/functions/v1/geocode-venue`;
  try {
    return await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY || ''),
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    translateNetworkError(error);
  }
}

export async function autocompleteVenueAddress(text: string): Promise<StandardizedAddress[]> {
  const query = text.trim();
  if (query.length < 3) return [];
  const response = await authorizedFetch({
    method: 'POST',
    body: JSON.stringify({ action: 'autocomplete', text: query }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(String(data?.error || 'Could not look up address suggestions.'));
  return (Array.isArray(data.results) ? data.results : [])
    .map((result: unknown) => mapGeoapifyResult(result as Parameters<typeof mapGeoapifyResult>[0]))
    .filter((result: StandardizedAddress | null): result is StandardizedAddress => Boolean(result));
}

export async function geocodeVenueAddress(address: VenueAddressInput): Promise<GeocodedAddress> {
  const state = normalizeUsState(address.stateRegion, { required: true });
  const postal = normalizeUsPostalCode(address.postalCode, { required: true });
  if (!state.ok) throw new Error(state.error);
  if (!postal.ok) throw new Error(postal.error);
  const response = await authorizedFetch({
    method: 'POST',
    body: JSON.stringify({
      action: 'verify',
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      stateRegion: state.value,
      postalCode: postal.value,
      country: address.country || 'US',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(String(data?.error || 'Could not verify this venue address.'));
  const mapped = mapGeoapifyResult(data.result) || undefined;
  return {
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    displayName: String(data.displayName || mapped?.formatted || ''),
    provider: 'geoapify',
    placeId: data.placeId ? String(data.placeId) : mapped?.placeId,
    address: mapped,
  };
}

export async function fetchGeoapifyTile(z: number, x: number, y: number, retina = false): Promise<Blob> {
  const response = await authorizedFetch({
    method: 'POST',
    body: JSON.stringify({ action: 'tile', z, x, y, retina }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(String((data as { error?: string }).error || 'Could not load map tiles.'));
  }
  return response.blob();
}
