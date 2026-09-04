import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuth,
  mockSurfaceAuth,
  clearPersistedAuthSurface,
  capturedSurfaces,
} = vi.hoisted(() => ({
  mockAuth: {
    verifyOtp: vi.fn(),
    setSession: vi.fn(),
    getSession: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    admin: { signOut: vi.fn() },
  },
  mockSurfaceAuth: {
    exchangeCodeForSession: vi.fn(),
  },
  clearPersistedAuthSurface: vi.fn(),
  capturedSurfaces: [] as string[],
}));

vi.mock('./supabaseClient', () => {
  const recoveryClient = { auth: mockAuth };
  const surfaceClient = { auth: mockSurfaceAuth };
  return {
    clearPersistedAuthSurface,
    discardSupabaseRecoveryClient: () => recoveryClient,
    getAuthSurface: () => 'platform',
    isSupabaseConfigured: () => true,
    getSupabaseClient: (surface: string) => {
      capturedSurfaces.push(`surface:${surface}`);
      return surfaceClient;
    },
    getSupabaseRecoveryClient: (surface: string) => {
      capturedSurfaces.push(`recovery:${surface}`);
      return recoveryClient;
    },
  };
});

import { completeSupabasePasswordRecovery } from './AuthBackend';

describe('password recovery compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedSurfaces.length = 0;
    mockSurfaceAuth.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'captured-access-token',
          refresh_token: 'captured-refresh-token',
          user: { id: 'user-1' },
        },
      },
      error: null,
    });
    mockAuth.setSession.mockResolvedValue({
      data: { session: { access_token: 'captured-access-token', user: { id: 'user-1' } } },
      error: null,
    });
    mockAuth.getSession.mockResolvedValue({
      data: { session: { access_token: 'captured-access-token', user: { id: 'user-1' } } },
      error: null,
    });
    mockAuth.updateUser.mockResolvedValue({ data: {}, error: null });
    mockAuth.signOut.mockResolvedValue({ error: null });
    mockAuth.admin.signOut.mockResolvedValue({ error: null });
    clearPersistedAuthSurface.mockReturnValue('captured-access-token');
  });

  it('still exchanges a legacy PKCE code on the matching surface', async () => {
    await completeSupabasePasswordRecovery({
      surface: 'venue',
      password: 'Newpass12!',
      code: 'pkce-code',
    });
    expect(capturedSurfaces).toEqual(['recovery:venue', 'surface:venue']);
    expect(mockSurfaceAuth.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    expect(mockAuth.setSession).toHaveBeenCalledWith({
      access_token: 'captured-access-token',
      refresh_token: 'captured-refresh-token',
    });
    expect(mockSurfaceAuth.exchangeCodeForSession.mock.invocationCallOrder[0])
      .toBeLessThan(clearPersistedAuthSurface.mock.invocationCallOrder[0]);
    expect(clearPersistedAuthSurface.mock.invocationCallOrder[0])
      .toBeLessThan(mockAuth.setSession.mock.invocationCallOrder[0]);
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'Newpass12!' });
    expect(mockAuth.admin.signOut).toHaveBeenCalledWith('captured-access-token', 'global');
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('still accepts legacy implicit recovery tokens', async () => {
    await completeSupabasePasswordRecovery({
      surface: 'platform',
      password: 'Newpass12!',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(mockAuth.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(mockAuth.updateUser).toHaveBeenCalledTimes(1);
  });

  it('does not change the password of an already signed-in session without recovery proof', async () => {
    await expect(
      completeSupabasePasswordRecovery({ surface: 'platform', password: 'Newpass12!' }),
    ).rejects.toMatchObject({ code: 'invalid_recovery_link' });
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
    expect(mockSurfaceAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });
});
