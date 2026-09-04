import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signInWithPassword, signOut, adminSignOut, getSession, clearPersistedAuthSurface, db } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  adminSignOut: vi.fn(),
  getSession: vi.fn(),
  clearPersistedAuthSurface: vi.fn(),
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
  clearPersistedAuthSurface,
  getAuthSurface: () => 'platform',
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    auth: { signInWithPassword, signOut, getSession, admin: { signOut: adminSignOut } },
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

import { restoreSupabaseSession, signInWithSupabase, signOutSupabase } from './AuthBackend';

describe('signInWithSupabase unauthorized discard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.membershipRow = null;
    db.organizationRow = { slug: 'seven-paths-manor', status: 'active' };
    db.platformRow = null;
    signOut.mockResolvedValue({ error: null });
    adminSignOut.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({
      data: { session: { access_token: 'tok', user: { id: 'user-1', email: 'ada@sevenpaths.com' } } },
      error: null,
    });
    signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'tok' },
        user: { id: 'user-1', email: 'ada@sevenpaths.com' },
      },
      error: null,
    });
  });

  it('clears a stale target session and returns a white-label credential error when the password is wrong', async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid login' } });
    await expect(signInWithSupabase('ada@sevenpaths.com', 'nope', 'org-1', 'venue')).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: 'The email address or password is incorrect.',
    });
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(clearPersistedAuthSurface).toHaveBeenCalledWith('venue');
  });

  it('removes persisted auth before a stalled remote revocation and retains the captured token', async () => {
    let finishRevocation!: (value: { error: null }) => void;
    clearPersistedAuthSurface.mockReturnValueOnce('captured-access-token');
    adminSignOut.mockImplementationOnce(() => new Promise((resolve) => { finishRevocation = resolve; }));

    const pending = signOutSupabase('venue', { scope: 'global' });
    expect(clearPersistedAuthSurface).toHaveBeenCalledWith('venue');
    expect(adminSignOut).toHaveBeenCalledWith('captured-access-token', 'global');
    expect(clearPersistedAuthSurface.mock.invocationCallOrder[0])
      .toBeLessThan(adminSignOut.mock.invocationCallOrder[0]);

    finishRevocation({ error: null });
    await pending;
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('locally signs out the venue client when the password is valid but the user is not a member', async () => {
    db.membershipRow = null;
    await expect(signInWithSupabase('ada@sevenpaths.com', 'secret', 'org-b', 'venue')).rejects.toMatchObject({
      code: 'venue_access_denied',
    });
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('locally signs out when the venue is suspended', async () => {
    db.membershipRow = { role: 'owner', status: 'active', organization_id: 'org-1' };
    db.organizationRow = { slug: 'seven-paths-manor', status: 'suspended' };
    await expect(signInWithSupabase('ada@sevenpaths.com', 'secret', 'org-1', 'venue')).rejects.toMatchObject({
      code: 'venue_unavailable',
    });
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

  it('allows venue login while the organization is still provisioning', async () => {
    db.membershipRow = { role: 'owner', status: 'active', organization_id: 'org-1' };
    db.organizationRow = { slug: 'hilltop-barn', status: 'provisioning' };
    const session = await signInWithSupabase('ada@sevenpaths.com', 'secret', 'org-1', 'venue');
    expect(signOut).not.toHaveBeenCalled();
    expect(session?.organizationId).toBe('org-1');
    expect(session?.organizationSlug).toBe('hilltop-barn');
  });

  it('locally signs out when the venue is archived', async () => {
    db.membershipRow = { role: 'owner', status: 'active', organization_id: 'org-1' };
    db.organizationRow = { slug: 'seven-paths-manor', status: 'archived' };
    await expect(signInWithSupabase('ada@sevenpaths.com', 'secret', 'org-1', 'venue')).rejects.toMatchObject({
      code: 'venue_unavailable',
    });
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('drops a restored venue identity that has no active venue membership', async () => {
    db.membershipRow = null;
    await expect(restoreSupabaseSession(undefined, 'venue')).resolves.toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(clearPersistedAuthSurface).toHaveBeenCalledWith('venue');
  });

  it('drops a restored platform identity that has no active platform membership', async () => {
    db.platformRow = null;
    await expect(restoreSupabaseSession(undefined, 'platform')).resolves.toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(clearPersistedAuthSurface).toHaveBeenCalledWith('platform');
  });

  it('restores only an identity with active platform membership on the platform surface', async () => {
    db.platformRow = { role: 'platform_admin', status: 'active' };
    const restored = await restoreSupabaseSession(undefined, 'platform');
    expect(restored?.platformRole).toBe('platform_admin');
    expect(restored?.user.role).toBe('admin');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('drops a restored venue session when the organization is suspended', async () => {
    db.membershipRow = { role: 'owner', status: 'active', organization_id: 'org-1' };
    db.organizationRow = { slug: 'seven-paths-manor', status: 'suspended' };
    await expect(restoreSupabaseSession(undefined, 'venue')).resolves.toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
