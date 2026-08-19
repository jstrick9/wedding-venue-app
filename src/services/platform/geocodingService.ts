import { getCurrentAccessToken, isSupabaseConfigured } from '../backend/supabaseClient';

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
  provider: 'nominatim';
}

export async function geocodeVenueAddress(address: VenueAddressInput): Promise<GeocodedAddress> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  const accessToken = await getCurrentAccessToken();
  if (!accessToken) throw new Error('Sign in as a platform administrator before geocoding a venue address.');
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geocode-venue`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY || ''),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(address),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(String(data?.error || 'Could not geocode this venue address.'));
  return {
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    displayName: String(data.displayName || ''),
    provider: 'nominatim',
  };
}
