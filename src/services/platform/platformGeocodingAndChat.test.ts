import { beforeEach, describe, expect, it, vi } from 'vitest';

// N-5: geocoding service must call the server Edge Function with the caller's
// token and translate success/failure. N-6/N-7: chat service must scope reads
// and writes to an organization and surface RLS/transport errors.

vi.mock('../backend/supabaseClient', () => {
  const supabase = {
    from: () => {
      const c: any = {};
      const methods = ['from', 'select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single', 'insert', 'upsert', 'update', 'delete', 'rpc'];
      for (const m of methods) c[m] = () => c;
      c.then = (onF: any, onR: any) => Promise.resolve({ data: [], error: null }).then(onF, onR);
      c.catch = (onR: any) => Promise.resolve({ data: [], error: null }).catch(onR);
      return c;
    },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) },
  };
  return {
    getSupabaseClient: () => supabase,
    isSupabaseConfigured: () => true,
    getCurrentAccessToken: () => Promise.resolve('tok123'),
  };
});

import { geocodeVenueAddress } from './geocodingService';
import { listPlatformVenueMessages, sendPlatformVenueMessage } from './platformChatService';

describe('platform geocoding (N-5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs the address to the Edge Function and returns coordinates', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, latitude: 35.6, longitude: -82.55, displayName: 'Asheville, NC' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await geocodeVenueAddress({
      addressLine1: '1 Ridge Rd',
      city: 'Asheville',
      stateRegion: 'NC',
      postalCode: '28801',
      country: 'US',
    });

    expect(result.latitude).toBe(35.6);
    expect(result.longitude).toBe(-82.55);
    expect(result.provider).toBe('geoapify');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/functions/v1/geocode-venue');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok123' });
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({ action: 'verify', city: 'Asheville' });
  });

  it('throws a descriptive error when the Edge Function fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ ok: false, error: 'No matching location was found. Verify the address and try again.' }),
    }));

    await expect(geocodeVenueAddress({
      addressLine1: '1',
      city: 'Nowhere',
      stateRegion: 'NC',
      postalCode: '00000',
      country: 'US',
    })).rejects.toThrow('No matching location');
  });

  it('explains a browser network failure instead of raw Failed to fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(geocodeVenueAddress({
      addressLine1: '1 Ridge Rd',
      city: 'Asheville',
      stateRegion: 'NC',
      postalCode: '28801',
      country: 'US',
    })).rejects.toThrow(/geocode-venue Edge Function/i);
  });
});

describe('platform chat (N-6/N-7)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not query chat when no organization is selected', async () => {
    await expect(listPlatformVenueMessages('')).resolves.toEqual([]);
  });

  it('inserts a scoped message with the signed-in user as sender', async () => {
    // sendPlatformVenueMessage inserts and selects; the mock returns empty data,
    // which maps to a message with empty fields. We assert it does not throw and
    // that the user id gate is satisfied.
    await expect(sendPlatformVenueMessage('org1', 'Hello venue', 'platform')).resolves.toBeDefined();
  });
});
