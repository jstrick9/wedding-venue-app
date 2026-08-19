// Supabase Edge Function: geocode-venue
// Server-side Geoapify proxy for address autocomplete, verification, and map tiles.
// The API key never ships to the browser.

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

function isVerifiedStreetAddress(result: Record<string, unknown> | null | undefined): boolean {
  if (!result) return false;
  const housenumber = normalize(result.housenumber);
  const street = normalize(result.street);
  const city = normalize(result.city || result.town || result.village);
  const state = normalize(result.state_code || result.state);
  const postal = normalize(result.postcode);
  const country = normalize(result.country_code || 'us').toLowerCase();
  if (country && country !== 'us') return false;
  if (!housenumber || !street || !city || !state || !postal) return false;
  const type = normalize(result.result_type);
  if (['city', 'postcode', 'state', 'county', 'country', 'street'].includes(type)) return false;
  const rank = (result.rank && typeof result.rank === 'object') ? result.rank as Record<string, unknown> : {};
  const confidence = Number(rank.confidence ?? 0);
  const matchType = normalize(rank.match_type);
  if (['full_match', 'inner_part', 'match_by_building'].includes(matchType)) return true;
  if (type === 'building' || type === 'amenity') return confidence >= 0.4 || Number(rank.confidence_building_level ?? 0) >= 0.5;
  return confidence >= 0.6;
}

async function requirePlatformAdmin(request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw json({ error: 'Geocoding service is not configured.' }, 500);
  const apiKey = Deno.env.get('GEOAPIFY_API_KEY');
  if (!apiKey) throw json({ error: 'Geoapify is not configured. Set the GEOAPIFY_API_KEY Edge Function secret.' }, 500);

  const authHeader = request.headers.get('Authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
  if (authError || !authData.user) throw json({ error: 'Unauthorized' }, 401);

  const { data: platformRole } = await adminClient
    .from('platform_memberships')
    .select('role,status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .in('role', ['platform_owner', 'platform_admin'])
    .maybeSingle();
  if (!platformRole) throw json({ error: 'Platform administrator access required.' }, 403);
  return { adminClient, apiKey };
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { adminClient, apiKey } = await requirePlatformAdmin(request);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const action = normalize(body?.action || 'verify') || 'verify';

    if (action === 'autocomplete') {
      const text = normalize(body?.text);
      if (text.length < 3) return json({ ok: true, results: [] });
      const params = new URLSearchParams({
        text,
        filter: 'countrycode:us',
        format: 'json',
        limit: '7',
        lang: 'en',
        apiKey,
      });
      const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return json({ error: 'Geoapify autocomplete request failed.' }, 502);
      const payload = await response.json().catch(() => ({}));
      return json({ ok: true, results: Array.isArray(payload?.results) ? payload.results : [] });
    }

    if (action === 'tile') {
      const z = Number(body?.z);
      const x = Number(body?.x);
      const y = Number(body?.y);
      if (![z, x, y].every((value) => Number.isInteger(value) && value >= 0) || z > 20) {
        return json({ error: 'Invalid map tile coordinates.' }, 400);
      }
      const retina = body?.retina === true;
      const tileUrl = `https://maps.geoapify.com/v1/tile/osm-bright/${z}/${x}/${y}${retina ? '@2x' : ''}.png?apiKey=${apiKey}`;
      const tile = await fetch(tileUrl);
      if (!tile.ok) return json({ error: 'Geoapify tile request failed.' }, 502);
      return new Response(tile.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const addressLine1 = normalize(body?.addressLine1);
    const city = normalize(body?.city);
    const stateRegion = normalize(body?.stateRegion);
    const postalCode = normalize(body?.postalCode);
    const country = normalize(body?.country) || 'US';
    if (!addressLine1 || !city || !stateRegion || !postalCode) {
      return json({ error: 'Complete venue address is required.' }, 400);
    }
    const normalizedAddress = [addressLine1, normalize(body?.addressLine2), city, stateRegion, postalCode, country].filter(Boolean).join(', ');
    const addressHash = await hash(`geoapify|${normalizedAddress}`);

    const { data: cached } = await adminClient
      .from('venue_geocode_cache')
      .select('display_name,latitude,longitude,provider')
      .eq('address_hash', addressHash)
      .maybeSingle();
    if (cached) {
      return json({
        ok: true,
        displayName: cached.display_name,
        latitude: cached.latitude,
        longitude: cached.longitude,
        provider: 'geoapify',
        cached: true,
      });
    }

    const params = new URLSearchParams({
      text: normalizedAddress,
      filter: 'countrycode:us',
      format: 'json',
      limit: '5',
      lang: 'en',
      apiKey,
    });
    const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return json({ error: 'Geoapify geocoding request failed.' }, 502);
    const payload = await response.json().catch(() => ({}));
    const results = Array.isArray(payload?.results) ? payload.results as Record<string, unknown>[] : [];
    const match = results.find((result) => isVerifiedStreetAddress(result)) || null;
    if (!match || match.lat == null || match.lon == null) {
      return json({ error: 'No matching US street address was found. Choose a suggestion from the list.' }, 404);
    }

    const result = {
      display_name: String(match.formatted || normalizedAddress),
      latitude: Number(match.lat),
      longitude: Number(match.lon),
      provider: 'geoapify',
    };
    await adminClient.from('venue_geocode_cache').upsert({
      address_hash: addressHash,
      normalized_address: normalizedAddress,
      ...result,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'address_hash' });

    return json({
      ok: true,
      displayName: result.display_name,
      latitude: result.latitude,
      longitude: result.longitude,
      provider: result.provider,
      placeId: match.place_id || null,
      result: match,
      cached: false,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: error instanceof Error ? error.message : 'Geocoding failed.' }, 500);
  }
});
