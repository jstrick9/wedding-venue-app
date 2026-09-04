import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.hoisted(() => vi.fn((
  _url: string,
  _key: string,
  _options: unknown,
) => ({
  instance: Symbol('recovery-client'),
})));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('ephemeral Supabase recovery clients', () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'publishable-test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('caches per surface only in memory and detaches by identity', async () => {
    const {
      discardSupabaseRecoveryClient,
      getSupabaseRecoveryClient,
    } = await import('./supabaseClient');

    const platform = getSupabaseRecoveryClient('platform');
    expect(getSupabaseRecoveryClient('platform')).toBe(platform);
    const venue = getSupabaseRecoveryClient('venue');
    expect(venue).not.toBe(platform);

    expect(createClientMock).toHaveBeenCalledTimes(2);
    expect(createClientMock.mock.calls[0][2]).toMatchObject({
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    expect(discardSupabaseRecoveryClient('platform', venue)).toBeUndefined();
    expect(getSupabaseRecoveryClient('platform')).toBe(platform);
    expect(discardSupabaseRecoveryClient('platform', platform)).toBe(platform);
    expect(getSupabaseRecoveryClient('platform')).not.toBe(platform);
    expect(createClientMock).toHaveBeenCalledTimes(3);
  });
});
