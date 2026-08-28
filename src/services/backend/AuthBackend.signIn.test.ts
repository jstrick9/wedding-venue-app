import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signInWithPassword, signOut, db } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  db: {
    membershipRow: null as Record<string, unknown> | null,
    organizationRow: null as Record<string, unknown> | null,
    platformRow: null as Record<string, unknown> | null,
  },
}));

function tableApi(result: { data: unknown; error: null }) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = self;
  api.eq = self;
  api.limit = self;
  api.maybeSingle = () => Promise.resolve(result);
  api.single = () => Promise.resolve(result);
  return api;
}

vi.mock('./supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    auth: { signInWithPassword, signOut },
    from: (table: string) => {
      if (table === 'profiles') {
        return tableApi({ data: { email: 'ada@sevenpaths.com', full_name: 'Ada' }, error: null });
      }
      if (table === 'organization_memberships') {
        return tableApi({ data: db.membershipRow, error: null });
      }
      if (table === 'organizations') {
        return tableApi({ data: db.organizationRow, error: null });
      }
      if (table === 'platform_memberships') {
        return tableApi({ data: db.platformRow, error: null });
      }
      return tableApi({ data: null, error: null });
    },
  }),
}));

import { signInWithSupabase } from './AuthBackend';

describe('signInWithSupabase unauthorized discard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.membershipRow = null;
    db.organizationRow = { slug: 'seven-paths-manor', status: 'active' };
    db.platformRow = null;
    signOut.mockResolvedValue({ error: null });
    signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'tok' },
        user: { id: 'user-1', email: 'ada@sevenpaths.com' },
      },
      error: null,
    });
  });

  it('does not sign out when the password is wrong', async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid login' } });
    await expect(signInWithSupabase('ada@sevenpaths.com', 'nope', 'org-1', 'venue')).resolves.toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('locally signs out the venue client when the password is valid but the user is not a member', async () => {
    db.membershipRow = null;
    await expect(signInWithSupabase('ada@sevenpaths.com', 'secret', 'org-b', 'venue')).resolves.toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('locally signs out when the venue is suspended', async () => {
    db.membershipRow = { role: 'owner', status: 'active', organization_id: 'org-1' };
    db.organizationRow = { slug: 'seven-paths-manor', status: 'suspended' };
    await expect(signInWithSupabase('ada@sevenpaths.com', 'secret', 'org-1', 'venue')).resolves.toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('keeps the venue session when the user is an active member', async () => {
    db.membershipRow = { role: 'owner', status: 'active', organization_id: 'org-1' };
    const session = await signInWithSupabase('ada@sevenpaths.com', 'secret', 'org-1', 'venue');
    expect(signOut).not.toHaveBeenCalled();
    expect(session?.organizationId).toBe('org-1');
    expect(session?.organizationSlug).toBe('seven-paths-manor');
    expect(session?.user.email).toBe('ada@sevenpaths.com');
  });
});
