import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
  getSession: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  adminSignOut: vi.fn(),
  clearPersistedAuthSurface: vi.fn(),
}));

vi.mock('./supabaseClient', () => {
  const createRecoveryClient = () => ({
    auth: {
      verifyOtp: mocks.verifyOtp,
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      setSession: mocks.setSession,
      getSession: mocks.getSession,
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
      admin: { signOut: mocks.adminSignOut },
    },
  });
  let recoveryClient: ReturnType<typeof createRecoveryClient> | undefined;
  const getRecoveryClient = () => {
    recoveryClient ||= createRecoveryClient();
    return recoveryClient;
  };
  return {
    clearPersistedAuthSurface: mocks.clearPersistedAuthSurface,
    discardSupabaseRecoveryClient: (
      _surface: string,
      expected?: ReturnType<typeof createRecoveryClient>,
    ) => {
      if (expected && recoveryClient !== expected) return undefined;
      const detached = recoveryClient;
      recoveryClient = undefined;
      return detached;
    },
    getAuthSurface: () => 'platform',
    isSupabaseConfigured: () => true,
    getSupabaseClient: getRecoveryClient,
    getSupabaseRecoveryClient: getRecoveryClient,
  };
});

import {
  abandonSupabasePasswordRecovery,
  completeSupabasePasswordRecovery,
} from './AuthBackend';

describe('completeSupabasePasswordRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyOtp.mockResolvedValue({
      data: { session: { access_token: 'recovery-access-token', user: { id: 'user-1' } } },
      error: null,
    });
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: 'recovery-access-token', user: { id: 'user-1' } } },
      error: null,
    });
    mocks.setSession.mockResolvedValue({
      data: { session: { access_token: 'recovery-access-token', user: { id: 'user-1' } } },
      error: null,
    });
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'recovery-access-token', user: { id: 'user-1' } } },
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
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearPersistedAuthSurface).toHaveBeenCalledWith('venue');
    expect(mocks.verifyOtp.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.updateUser.mock.invocationCallOrder[0]);
    expect(mocks.updateUser.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.adminSignOut.mock.invocationCallOrder[0]);
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

  it('retains the verified memory-only session after a rejected candidate and retries without reusing the proof', async () => {
    mocks.updateUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: {
          code: 'same_password',
          message: 'New password should be different from old password',
        },
      })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });
    const proof = {
      surface: 'platform' as const,
      tokenHash: 'hashed-token',
    };

    await expect(completeSupabasePasswordRecovery({
      ...proof,
      password: 'Newpass12!',
    })).rejects.toMatchObject({
      code: 'password_unchanged',
      message: expect.stringMatching(/different from your current password/i),
    });
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.adminSignOut).not.toHaveBeenCalled();

    await expect(completeSupabasePasswordRecovery({
      ...proof,
      password: 'weak',
    })).rejects.toMatchObject({ code: 'password_rejected' });
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).not.toHaveBeenCalled();

    await completeSupabasePasswordRecovery({
      ...proof,
      password: 'Different12!',
    });

    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser).toHaveBeenCalledTimes(2);
    expect(mocks.getSession).toHaveBeenCalled();
    expect(mocks.adminSignOut).toHaveBeenCalledWith('recovery-access-token', 'global');
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('retains recovery authorization after a password-history rejection', async () => {
    mocks.updateUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: {
          code: 'password_history',
          message: 'Password has previously been used',
        },
      })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });
    const proof = {
      surface: 'venue' as const,
      tokenHash: 'hashed-token',
    };

    await expect(completeSupabasePasswordRecovery({
      ...proof,
      password: 'Previous12!',
    })).rejects.toMatchObject({
      code: 'password_previously_used',
      message: expect.stringMatching(/used before/i),
    });
    await completeSupabasePasswordRecovery({
      ...proof,
      password: 'Different12!',
    });

    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser).toHaveBeenCalledTimes(2);
    expect(mocks.adminSignOut).toHaveBeenCalledWith('recovery-access-token', 'global');
  });

  it('serializes same-surface submissions so a retry cannot race proof exchange', async () => {
    let rejectFirstUpdate!: (value: { data: { user: null }; error: { message: string } }) => void;
    mocks.updateUser
      .mockReturnValueOnce(new Promise((resolve) => {
        rejectFirstUpdate = resolve;
      }))
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });
    const proof = {
      surface: 'platform' as const,
      tokenHash: 'hashed-token',
    };

    const first = completeSupabasePasswordRecovery({ ...proof, password: 'Current12!' });
    const second = completeSupabasePasswordRecovery({ ...proof, password: 'Different12!' });
    await vi.waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);

    rejectFirstUpdate({
      data: { user: null },
      error: { message: 'New password should be different from old password' },
    });
    await expect(first).rejects.toMatchObject({ code: 'password_unchanged' });
    await second;

    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser).toHaveBeenCalledTimes(2);
    expect(mocks.adminSignOut).toHaveBeenCalledWith('recovery-access-token', 'global');
  });

  it('preserves global revocation when the user leaves during an in-flight successful save', async () => {
    let resolveUpdate!: (value: { data: { user: { id: string } }; error: null }) => void;
    mocks.updateUser.mockReturnValueOnce(new Promise((resolve) => {
      resolveUpdate = resolve;
    }));

    const completion = completeSupabasePasswordRecovery({
      surface: 'venue',
      password: 'Different12!',
      tokenHash: 'hashed-token',
    });
    await vi.waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));

    abandonSupabasePasswordRecovery('venue');
    expect(mocks.adminSignOut).not.toHaveBeenCalled();
    resolveUpdate({ data: { user: { id: 'user-1' } }, error: null });
    await completion;

    expect(mocks.adminSignOut).toHaveBeenCalledWith('recovery-access-token', 'global');
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('discards an idle retry capability when recovery is abandoned', async () => {
    mocks.updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'New password should be different from old password' },
    });

    const proof = {
      surface: 'platform' as const,
      password: 'Current12!',
      tokenHash: 'hashed-token',
    };
    await expect(completeSupabasePasswordRecovery(proof))
      .rejects.toMatchObject({ code: 'password_unchanged' });

    abandonSupabasePasswordRecovery('platform');
    await vi.waitFor(() => {
      expect(mocks.adminSignOut).toHaveBeenCalledWith('recovery-access-token', 'local');
    });

    mocks.verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Token has already been used' },
    });
    await expect(completeSupabasePasswordRecovery({
      ...proof,
      password: 'Different12!',
    })).rejects.toMatchObject({ code: 'invalid_recovery_link' });
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(2);
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
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
