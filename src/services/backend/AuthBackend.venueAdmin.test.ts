import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const rpc = vi.fn();
const updateEq = vi.fn();
const getUser = vi.fn();
const getSession = vi.fn();
const claimMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  clearPersistedAuthSurface: vi.fn(),
  getAuthSurface: () => 'platform',
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    auth: { signInWithPassword, signUp, getUser, getSession },
    from: () => ({ update: () => ({ eq: updateEq }) }),
    rpc,
  }),
}));

vi.mock('../platform/claimVenueAdminAccount', async () => {
  const actual = await vi.importActual<typeof import('../platform/claimVenueAdminAccount')>('../platform/claimVenueAdminAccount');
  return {
    ...actual,
    claimVenueAdminAccount: (...args: unknown[]) => claimMock(...args),
  };
});

import { CLAIM_FUNCTION_MISSING } from '../platform/claimVenueAdminAccount';
import { signUpVenueAdminWithInvite } from './AuthBackend';

describe('signUpVenueAdminWithInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateEq.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'venue.owner@example.com' } },
      error: null,
    });
    getSession.mockResolvedValue({
      data: { session: { access_token: 'tok', user: { id: 'user-1' } } },
      error: null,
    });
    rpc.mockResolvedValue({
      data: {
        ok: true,
        organization_id: 'org-1',
        organization_name: 'Seven Paths Manor',
        organization_slug: 'seven-paths-manor',
      },
      error: null,
    });
  });

  it('sets a new password on an existing venue account and accepts without creating an organization', async () => {
    claimMock.mockResolvedValue({
      email: 'venue.owner@example.com',
      existingUser: true,
      organizationId: 'org-1',
      organizationName: 'Seven Paths Manor',
      organizationSlug: 'seven-paths-manor',
    });
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'tok' }, user: { id: 'user-1', email: 'venue.owner@example.com' } },
      error: null,
    });

    const session = await signUpVenueAdminWithInvite({
      email: 'venue.owner@example.com',
      password: 'New-pass-123',
      fullName: 'Joshua Strickland',
      inviteToken: 'va-abc123def4567890',
    });

    expect(claimMock).toHaveBeenCalledWith({
      token: 'va-abc123def4567890',
      password: 'New-pass-123',
      fullName: 'Joshua Strickland',
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'venue.owner@example.com',
      password: 'New-pass-123',
    });
    expect(signUp).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('accept_venue_admin_invite', { p_token: 'va-abc123def4567890' });
    expect(session.organizationSlug).toBe('seven-paths-manor');
    expect(session.organizationId).toBe('org-1');
    expect(session.user.email).toBe('venue.owner@example.com');
  });

  it('skips the client-side accept when the Edge Function already claimed atomically (0017)', async () => {
    claimMock.mockResolvedValue({
      email: 'venue.owner@example.com',
      existingUser: true,
      claimed: true,
      organizationId: 'org-1',
      organizationName: 'Seven Paths Manor',
      organizationSlug: 'seven-paths-manor',
    });
    signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'tok' },
        user: { id: 'user-1', email: 'venue.owner@example.com' },
      },
      error: null,
    });

    const session = await signUpVenueAdminWithInvite({
      email: 'venue.owner@example.com',
      password: 'New-pass-123',
      fullName: 'Joshua Strickland',
      inviteToken: 'va-abc123def4567890',
    });

    // The claim already transferred ownership server-side — no accept RPC.
    expect(rpc).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
    expect(session.organizationId).toBe('org-1');
    expect(session.organizationSlug).toBe('seven-paths-manor');
    expect(session.accessToken).toBe('tok');
    expect(session.user.email).toBe('venue.owner@example.com');
  });

  it('still runs the client-side accept when the claim was not atomic (pre-0017)', async () => {
    claimMock.mockResolvedValue({
      email: 'venue.owner@example.com',
      existingUser: false,
      claimed: false,
      organizationId: 'org-1',
      organizationName: 'Seven Paths Manor',
      organizationSlug: 'seven-paths-manor',
    });
    signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'tok' },
        user: { id: 'user-1', email: 'venue.owner@example.com' },
      },
      error: null,
    });

    const session = await signUpVenueAdminWithInvite({
      email: 'venue.owner@example.com',
      password: 'New-pass-123',
      fullName: 'Joshua Strickland',
      inviteToken: 'va-abc123def4567890',
    });

    expect(rpc).toHaveBeenCalledWith('accept_venue_admin_invite', { p_token: 'va-abc123def4567890' });
    expect(session.organizationId).toBe('org-1');
  });

  it('hides deployment details when reissue account setup is unavailable', async () => {
    claimMock.mockRejectedValue(new Error(CLAIM_FUNCTION_MISSING));
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('User already registered'),
    });

    await expect(signUpVenueAdminWithInvite({
      email: 'venue.owner@example.com',
      password: 'New-pass-123',
      fullName: 'Joshua Strickland',
      inviteToken: 'va-abc123def4567890',
    })).rejects.toThrow(/account setup is temporarily unavailable/i);
    expect(rpc).not.toHaveBeenCalled();
  });
});
