// Supabase Edge Function: geocode-venue
// Server-side Nominatim proxy with a database cache.
//
// Nominatim public service requirements:
// - maximum one request per second;
// - descriptive User-Agent/Referer;
// - cache results;
// - no browser autocomplete or systematic bulk geocoding.
// See https://operations.osmfoundation.org/policies/nominatim/

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function normalize(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value.toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Geocoding service is not configured.' }, 500);

  const authHeader = request.headers.get('Authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
  if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401);

  const { data: platformRole } = await adminClient
    .from('platform_memberships')
    .select('role,status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .in('role', ['platform_owner', 'platform_admin'])
    .maybeSingle();
  if (!platformRole) return json({ error: 'Platform administrator access required.' }, 403);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const parts = [body?.addressLine1, body?.addressLine2, body?.city, body?.stateRegion, body?.postalCode, body?.country].map(normalize);
  if (!parts[0] || !parts[2] || !parts[3] || !parts[4]) return json({ error: 'Complete venue address is required.' }, 400);
  const normalizedAddress = parts.filter(Boolean).join(', ');
  const addressHash = await hash(normalizedAddress);

  const { data: cached } = await adminClient
    .from('venue_geocode_cache')
    .select('display_name,latitude,longitude,provider')
    .eq('address_hash', addressHash)
    .maybeSingle();
  if (cached) return json({ ok: true, displayName: cached.display_name, latitude: cached.latitude, longitude: cached.longitude, provider: cached.provider, cached: true });

  // Respect Nominatim's ~1 request/second public policy: acquire a server-side
  // rate slot before hitting the external service. A cached result bypasses this.
  const { data: slot, error: slotError } = await adminClient.rpc('geocode_try_acquire_slot');
  if (slotError || slot !== true) {
    return json({ ok: false, error: 'Rate limit reached. Please wait a moment and try again.' }, 429);
  }

  // Nominatim is deliberately called only by this server function, not by the
  // browser. The cache prevents repeated queries for the same venue address.
  const query = new URLSearchParams({
    street: parts[0],
    city: parts[2],
    state: parts[3],
    postalcode: parts[4],
    country: parts[5] || 'US',
    countrycodes: (parts[5] || 'US').toLowerCase() === 'us' || (parts[5] || 'US').toLowerCase() === 'united states' ? 'us' : '',
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
  });
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?${query.toString()}`;
  const response = await fetch(nominatimUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'WeddingVenueIntelligencePlatform/1.0 (venue-geocoding; contact platform administrator)',
      Referer: Deno.env.get('PUBLIC_APP_URL') || 'https://wedding-venue-intelligence-platform.example',
    },
  });
  if (!response.ok) return json({ error: 'Nominatim geocoding request failed.' }, 502);
  const results = await response.json().catch(() => []);
  const match = Array.isArray(results) ? results[0] : null;
  if (!match?.lat || !match?.lon) return json({ error: 'No matching location was found. Verify the address and try again.' }, 404);

  const result = {
    display_name: String(match.display_name || normalizedAddress),
    latitude: Number(match.lat),
    longitude: Number(match.lon),
    provider: 'nominatim',
  };
  await adminClient.from('venue_geocode_cache').upsert({ address_hash: addressHash, normalized_address: normalizedAddress, ...result, updated_at: new Date().toISOString() }, { onConflict: 'address_hash' });
  return json({ ok: true, displayName: result.display_name, latitude: result.latitude, longitude: result.longitude, provider: result.provider, cached: false });
});
