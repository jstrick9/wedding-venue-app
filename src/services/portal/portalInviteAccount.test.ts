import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  rpc: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../backend/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: (...args: unknown[]) => mocks.getSupabaseClient(...args),
  createDeadlineFetch: () => fetch,
}));

import {
  claimOrSignInPortalInvite,
  lookupPortalInviteContext,
  signOutPortalAccount,
} from './portalInviteAccount';

const rawContext = {
  ok: true,
  kind: 'guest',
  organization_id: 'org-1',
  organization_name: 'Seven Paths Manor',
  organization_slug: 'seven-paths',
  couple_id: 'couple-1',
  couple_name: 'Alex & Morgan',
  participant_type: 'guest',
  participant_id: 'guest-1',
  email: 'guest@example.com',
  full_name: 'Taylor Guest',
  role: 'guest',
  account_required: true,
  account_claimed: true,
  authenticated: true,
};

describe('portalInviteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    mocks.getSupabaseClient.mockReturnValue({
      rpc: mocks.rpc,
      auth: {
        signInWithPassword: mocks.signInWithPassword,
        signOut: mocks.signOut,
      },
    });
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'jwt' }, user: { id: 'user-1' } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: rawContext, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it('looks up safe invite context through the invitee-specific auth client', async () => {
    const result = await lookupPortalInviteContext({
      kind: 'guest',
      token: 'guest-token-at-least-sixteen',
      coupleId: 'couple-1',
      venueSlug: 'seven-paths',
    });

    expect(mocks.getSupabaseClient).toHaveBeenCalledWith('guest');
    expect(mocks.rpc).toHaveBeenCalledWith('get_portal_invite_context', {
      p_kind: 'guest',
      p_token: 'guest-token-at-least-sixteen',
      p_couple_id: 'couple-1',
      p_venue_slug: 'seven-paths',
    });
    expect(result).toEqual({
      available: true,
      context: expect.objectContaining({
        participantId: 'guest-1',
        email: 'guest@example.com',
        accountRequired: true,
        authenticated: true,
      }),
    });
  });

  it('falls back only for an undeployed RPC, never for a timeout or network error', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function in the schema cache' },
    });
    await expect(lookupPortalInviteContext({
      kind: 'guest',
      token: 'guest-token-at-least-sixteen',
      coupleId: 'couple-1',
    })).resolves.toEqual({ available: false, context: null });

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '', message: 'Failed to fetch /rpc/get_portal_invite_context' },
    });
    await expect(lookupPortalInviteContext({
      kind: 'guest',
      token: 'guest-token-at-least-sixteen',
      coupleId: 'couple-1',
    })).resolves.toEqual({
      available: true,
      context: null,
      error: 'Failed to fetch /rpc/get_portal_invite_context',
    });
  });

  it('authenticates an existing global identity before attaching the invite', async () => {
    const context = await claimOrSignInPortalInvite({
      kind: 'couple',
      mode: 'sign-in',
      token: 'couple-token-at-least-sixteen',
      email: 'Couple@Example.com ',
      password: 'their existing password',
      fullName: 'Alex Couple',
    });

    expect(mocks.getSupabaseClient).toHaveBeenCalledWith('couple');
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'couple@example.com',
      password: 'their existing password',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('accept_portal_invite', {
      p_kind: 'couple',
      p_token: 'couple-token-at-least-sixteen',
      p_couple_id: null,
      p_full_name: 'Alex Couple',
    });
    expect(context.authenticated).toBe(true);
  });

  it('enforces the strong policy before attempting account creation', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(claimOrSignInPortalInvite({
      kind: 'guest',
      mode: 'create',
      token: 'guest-token-at-least-sixteen',
      coupleId: 'couple-1',
      email: 'guest@example.com',
      password: 'lowercase1!',
      fullName: 'Taylor Guest',
    })).rejects.toThrow(/uppercase letter/i);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('never resets an existing Auth user and instead signs in after account_exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'account_exists' }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await claimOrSignInPortalInvite({
      kind: 'guest',
      mode: 'create',
      token: 'guest-token-at-least-sixteen',
      coupleId: 'couple-1',
      venueSlug: 'seven-paths',
      email: 'guest@example.com',
      password: 'Strong#9',
      fullName: 'Taylor Guest',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/claim-portal-invite',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer anon-key', apikey: 'anon-key' }),
      }),
    );
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'guest@example.com',
      password: 'Strong#9',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('accept_portal_invite', expect.any(Object));
  });

  it('signs out only the selected portal auth surface and clears its browser JWT', async () => {
    localStorage.setItem('wvip-auth-guest', '{"access_token":"jwt"}');
    localStorage.setItem('wvip-auth-couple', '{"access_token":"other-jwt"}');

    await signOutPortalAccount('guest');

    expect(mocks.getSupabaseClient).toHaveBeenCalledWith('guest');
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(localStorage.getItem('wvip-auth-guest')).toBeNull();
    expect(localStorage.getItem('wvip-auth-couple')).not.toBeNull();
  });

  it('clears the local portal JWT even when Supabase logout cannot reach the network', async () => {
    localStorage.setItem('wvip-auth-couple', '{"access_token":"jwt"}');
    mocks.signOut.mockRejectedValueOnce(new Error('offline'));

    await expect(signOutPortalAccount('couple')).rejects.toThrow('offline');

    expect(localStorage.getItem('wvip-auth-couple')).toBeNull();
  });
});
