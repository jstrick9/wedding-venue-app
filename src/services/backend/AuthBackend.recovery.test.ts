import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  adminSignOut: vi.fn(),
  clearPersistedAuthSurface: vi.fn(),
}));

vi.mock('./supabaseClient', () => ({
  clearPersistedAuthSurface: mocks.clearPersistedAuthSurface,
  getAuthSurface: () => 'platform',
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({ auth: { ...mocks, admin: { signOut: mocks.adminSignOut } } }),
}));

import { completeSupabasePasswordRecovery } from './AuthBackend';

describe('completeSupabasePasswordRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyOtp.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    mocks.setSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    mocks.updateUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.adminSignOut.mockResolvedValue({ error: null });
    mocks.clearPersistedAuthSurface.mockReturnValue('recovery-access-token');
  });

  it('verifies a direct recovery proof, updates the password, and requires a fresh login', async () => {
    await completeSupabasePasswordRecovery({
      surface: 'venue',
      password: 'Newpass12!',
      tokenHash: 'hashed-token',
    });

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'hashed-token',
      type: 'recovery',
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'Newpass12!' });
    expect(mocks.adminSignOut).toHaveBeenCalledWith('recovery-access-token', 'global');
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.clearPersistedAuthSurface).toHaveBeenCalledWith('venue');
    const firstClear = mocks.clearPersistedAuthSurface.mock.invocationCallOrder[0];
    expect(mocks.updateUser.mock.invocationCallOrder[0]).toBeLessThan(firstClear);
    expect(firstClear).toBeLessThan(mocks.adminSignOut.mock.invocationCallOrder[0]);
  });

  it('never lets an unrelated existing session authorize a password change without recovery proof', async () => {
    await expect(completeSupabasePasswordRecovery({
      surface: 'venue',
      password: 'Newpass12!',
    })).rejects.toMatchObject({ code: 'invalid_recovery_link' });

    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('does not update the password when token verification fails and hides the raw error', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: 'Auth provider invalid OTP from database' },
    });

    await expect(completeSupabasePasswordRecovery({
      surface: 'platform',
      password: 'Newpass12!',
      tokenHash: 'bad-token',
    })).rejects.toMatchObject({
      code: 'invalid_recovery_link',
      message: expect.not.stringMatching(/provider|database/i),
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('clears the recovery session when password update fails', async () => {
    mocks.updateUser.mockResolvedValue({ data: { user: null }, error: { message: 'Password should be different' } });

    await expect(completeSupabasePasswordRecovery({
      surface: 'platform',
      password: 'Newpass12!',
      tokenHash: 'hashed-token',
    })).rejects.toMatchObject({ code: 'password_rejected' });
    expect(mocks.adminSignOut).toHaveBeenCalledWith('recovery-access-token', 'local');
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.clearPersistedAuthSurface.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.adminSignOut.mock.invocationCallOrder[0]);
  });

  it('enforces the shared strong-password policy before consuming recovery proof', async () => {
    await expect(completeSupabasePasswordRecovery({
      surface: 'platform',
      password: 'abcdefgh',
      tokenHash: 'hashed-token',
    })).rejects.toMatchObject({ code: 'password_rejected' });
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
});
