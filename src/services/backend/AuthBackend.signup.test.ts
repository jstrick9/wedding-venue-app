import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = {
  signUp: vi.fn(),
};
const mockFrom = vi.fn();
const mockClient = {
  auth: mockAuth,
  from: mockFrom,
};

vi.mock('./supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => mockClient,
}));

import { signUpWithSupabase } from './AuthBackend';

describe('signUpWithSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the auth user, bootstraps an organization + owner membership, and returns a session', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'a@b.com' },
        session: { access_token: 'tok', user: { id: 'u1' } },
      },
      error: null,
    });

    // organizations.insert then .select
    const insertOrg = { error: null };
    const selectOrg = { data: { id: 'org1' }, error: null };
    const insertMembership = { error: null };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          insert: () => insertOrg,
          select: () => ({ eq: () => ({ maybeSingle: () => selectOrg }) }),
        };
      }
      if (table === 'organization_memberships') {
        return { insert: () => insertMembership };
      }
      return {};
    });

    const session = await signUpWithSupabase({
      email: 'a@b.com',
      password: 'password123',
      fullName: 'Alice',
      organizationName: 'Lilac Venue',
    });

    expect(session.accessToken).toBe('tok');
    expect(session.organizationId).toBe('org1');
    expect(session.user.email).toBe('a@b.com');
    expect(session.user.role).toBe('admin');
    expect(session.user.requiresPasswordChange).toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith('organizations');
    expect(mockFrom).toHaveBeenCalledWith('organization_memberships');
  });

  it('throws when the auth sign-up fails', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('email exists'),
    });

    await expect(
      signUpWithSupabase({ email: 'a@b.com', password: 'password123', fullName: 'A' }),
    ).rejects.toThrow('email exists');
  });
});
