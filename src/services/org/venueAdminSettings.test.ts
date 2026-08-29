import { beforeEach, describe, expect, it } from 'vitest';
import { createInvite, acceptInvite } from './inviteService';

/**
 * Venue-admin persona: Admin & System Settings — inviting team members (local mode)
 * and accepting invites, which is how the venue brings staff into the platform.
 */
describe('admin & system settings — invites (venue admin)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates an invite in local mode and returns an accept URL', async () => {
    const res = await createInvite({
      organizationId: 'org-1',
      inviterUserId: 'u-admin',
      email: 'staff@venue.com',
      role: 'staff',
      organizationName: 'Seven Paths Manor',
    });
    expect(res.ok).toBe(true);
    expect(res.inviteUrl).toContain('/accept-invite/');
    expect(res.inviteUrl).not.toContain('#');
    const stored = JSON.parse(localStorage.getItem('spm_org_invites') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].email).toBe('staff@venue.com');
    expect(stored[0].status).toBe('pending');
  });

  it('accepts a created invite in local mode', async () => {
    const res = await createInvite({
      organizationId: 'org-1', inviterUserId: 'u-admin',
      email: 'planner@venue.com', role: 'planner', organizationName: 'Venue',
    });
    const token = res.inviteUrl!.split('/').pop()!;
    const accepted = await acceptInvite(token);
    expect(accepted.ok).toBe(true);
  });
});
