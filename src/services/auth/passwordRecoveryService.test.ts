import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
}));

import {
  PASSWORD_RESET_UNAVAILABLE_MESSAGE,
  describePasswordResetRequestError,
  requestPasswordReset,
} from './passwordRecoveryService';

describe('passwordRecoveryService', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.example.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-key');
    window.history.replaceState(null, '', '/#/venue-login/hilltop-barn');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('requests a tenant-scoped venue reset without sending branding or trusted role claims', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ ok: true }),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    ));

    await requestPasswordReset({
      email: '  Owner@Example.com ',
      surface: 'venue',
      organizationId: '11111111-1111-4111-8111-111111111111',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://project.example.test/functions/v1/request-password-reset');
    expect(init?.headers).toMatchObject({ apikey: 'public-key' });
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'owner@example.com',
      surface: 'venue',
      organizationId: '11111111-1111-4111-8111-111111111111',
      redirectTo: `${window.location.origin}/reset/venue`,
    });
  });

  it('maps a raw service response to a stable white-label message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'Supabase SMTP provider rejected request' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(requestPasswordReset({
      email: 'owner@example.com',
      surface: 'platform',
    })).rejects.toThrow(PASSWORD_RESET_UNAVAILABLE_MESSAGE);
    expect(describePasswordResetRequestError(new Error('Vercel or Supabase failed'))).toBe(
      PASSWORD_RESET_UNAVAILABLE_MESSAGE,
    );
  });

  it('rejects invalid email locally without making a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(requestPasswordReset({ email: 'not-an-email', surface: 'platform' }))
      .rejects.toThrow('Enter a valid email address.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a server-verifiable organization scope for venue recovery', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(requestPasswordReset({ email: 'owner@example.com', surface: 'venue' }))
      .rejects.toThrow(PASSWORD_RESET_UNAVAILABLE_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
