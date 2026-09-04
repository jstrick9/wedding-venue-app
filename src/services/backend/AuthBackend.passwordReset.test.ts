import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAuth, clearPersistedAuthSurface, capturedSurfaces } = vi.hoisted(() => ({
  mockAuth: {
    verifyOtp: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    setSession: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    admin: { signOut: vi.fn() },
  },
  clearPersistedAuthSurface: vi.fn(),
  capturedSurfaces: [] as string[],
}));

vi.mock('./supabaseClient', () => ({
  clearPersistedAuthSurface,
  getAuthSurface: () => 'platform',
  isSupabaseConfigured: () => true,
  getSupabaseClient: (surface?: string) => {
    if (surface) capturedSurfaces.push(surface);
    return { auth: mockAuth };
  },
}));

import { completeSupabasePasswordRecovery } from './AuthBackend';

describe('password recovery compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedSurfaces.length = 0;
    mockAuth.exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    mockAuth.setSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
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
    expect(capturedSurfaces).toEqual(['venue']);
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'Newpass12!' });
    expect(mockAuth.admin.signOut).toHaveBeenCalledWith('captured-access-token', 'global');
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
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
    expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });
});
