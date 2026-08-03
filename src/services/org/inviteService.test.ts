import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform', () => ({
  getPlatformProvider: () => 'local',
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

describe('inviteService (local)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a local invite and returns an accept URL', async () => {
    const res = await createInvite(params);
    expect(res.ok).toBe(true);
    expect(res.inviteUrl).toContain('#/accept-invite/');
    expect(JSON.parse(localStorage.getItem('spm_org_invites') || '[]')).toHaveLength(1);
  });

  it('acceptInvite resolves a matching pending invite', async () => {
    const created = await createInvite(params);
    const token = created.inviteUrl!.split('/').pop()!;
    const ok = await acceptInvite(token);
    expect(ok.ok).toBe(true);
    // Second accept fails.
    const again = await acceptInvite(token);
    expect(again.ok).toBe(false);
  });

  it('acceptInvite rejects an unknown invite', async () => {
    const res = await acceptInvite('does-not-exist');
    expect(res.ok).toBe(false);
  });
});
