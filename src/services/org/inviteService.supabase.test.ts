import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform', () => ({
  getPlatformProvider: () => 'supabase',
}));

const insert = vi.fn();
const rpc = vi.fn();
vi.mock('../backend/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    from: (t: string) => (t === 'org_invites' ? { insert: (row: any) => ({ error: insert(row) }) } : {}),
    rpc,
  }),
}));

const invoke = vi.fn();
vi.mock('../backend/EmailService', () => ({
  sendTransactionalEmail: (p: any) => invoke(p),
  buildInvitationTemplateData: (d: any) => d,
}));

import { acceptInvite, createInvite } from './inviteService';

const params = {
  organizationId: 'org1',
  inviterUserId: 'u1',
  email: 'staff@x.com',
  role: 'staff' as const,
  organizationName: 'Lilac Venue',
  appBaseUrl: 'https://app.example.com',
};

describe('inviteService (supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Provide crypto for token generation + sha256.
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => { for (let i = 0; i < arr.length; i++) arr[i] = i; return arr; },
      subtle: { digest: async () => new Uint8Array([1,2,3,4]).buffer },
    });
  });

  it('createInvite inserts a hashed invite row and sends an invitation email', async () => {
    insert.mockReturnValue(null);
    invoke.mockResolvedValue(undefined);

    const res = await createInvite(params);

    expect(res.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      organization_id: 'org1',
      email: 'staff@x.com',
      role: 'staff',
      token_hash: expect.any(String),
      status: 'pending',
    }));
    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({
      to: 'staff@x.com',
      purpose: 'invitation',
      organizationId: 'org1',
    }));
    expect(res.inviteUrl).toContain('/accept-invite/');
    expect(res.inviteUrl).not.toContain('#');
    expect(res.inviteUrl).not.toContain('?');
  });

  it('acceptInvite calls the accept_invite RPC', async () => {
    rpc.mockResolvedValue({ data: { ok: true, organization_id: 'org1', organization_name: 'Lilac Venue' }, error: null });
    const res = await acceptInvite('token123');
    expect(res.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith('accept_invite', { p_token: 'token123' });
  });
});
