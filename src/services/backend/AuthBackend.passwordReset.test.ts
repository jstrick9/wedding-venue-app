import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = {
  resetPasswordForEmail: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
  getSession: vi.fn(),
  updateUser: vi.fn(),
};
const capturedSurfaces: string[] = [];

vi.mock('./supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: (surface?: string) => {
    if (surface) capturedSurfaces.push(surface);
    return { auth: mockAuth };
  },
}));

import { completeSupabasePasswordRecovery, requestSupabasePasswordReset } from './AuthBackend';

describe('Supabase password recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedSurfaces.length = 0;
    mockAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    mockAuth.setSession.mockResolvedValue({ data: {}, error: null });
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockAuth.updateUser.mockResolvedValue({ data: {}, error: null });
  });

  it('sends a path-only platform redirect on the platform client', async () => {
    await requestSupabasePasswordReset('punistricker@gmail.com', 'platform');
    expect(capturedSurfaces).toEqual(['platform']);
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    const [email, options] = mockAuth.resetPasswordForEmail.mock.calls[0];
    expect(email).toBe('punistricker@gmail.com');
    expect(options.redirectTo).toMatch(/\/reset\/platform$/);
    expect(options.redirectTo).not.toMatch(/[?#]/);
  });

  it('sends a venue redirect on the venue client', async () => {
    await requestSupabasePasswordReset('ada@sevenpaths.com', 'venue');
    expect(capturedSurfaces).toEqual(['venue']);
    const options = mockAuth.resetPasswordForEmail.mock.calls[0][1] as { redirectTo: string };
    expect(options.redirectTo).toMatch(/\/reset\/venue$/);
  });

  it('exchanges a PKCE code on the matching surface then updates the password', async () => {
    await completeSupabasePasswordRecovery({
      surface: 'venue',
      password: 'Newpass12',
      code: 'pkce-code',
    });
    expect(capturedSurfaces).toEqual(['venue']);
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'Newpass12' });
  });

  it('rejects a missing recovery session', async () => {
    await expect(
      completeSupabasePasswordRecovery({ surface: 'platform', password: 'Newpass12' }),
    ).rejects.toThrow(/missing or incomplete/i);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });
});
