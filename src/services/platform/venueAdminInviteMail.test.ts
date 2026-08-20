import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('../backend/EmailService', () => ({
  sendTransactionalEmail: (...args: unknown[]) => sendMock(...args),
}));

import { sendVenueAdminInviteEmail } from './venueAdminInviteMail';

describe('sendVenueAdminInviteEmail', () => {
  beforeEach(() => {
    sendMock.mockReset().mockResolvedValue(undefined);
  });

  it('sends a venue_admin_invite with a filled template', async () => {
    await sendVenueAdminInviteEmail({
      to: 'owner@hilltop.com',
      organizationId: 'org9',
      organizationName: 'Hilltop Barn',
      inviteUrl: 'https://app.example/#/venue-onboarding?token=abc',
      expiresAt: '2026-08-27T00:00:00.000Z',
      platformName: 'Platform',
    });
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@hilltop.com',
      purpose: 'venue_admin_invite',
      organizationId: 'org9',
    }));
    const data = sendMock.mock.calls[0][0].templateData;
    expect(data.body).toContain('Hilltop Barn');
    expect(data.body).toContain('https://app.example/#/venue-onboarding?token=abc');
  });

  it('rejects a template that drops the invite URL', async () => {
    await expect(sendVenueAdminInviteEmail({
      to: 'owner@hilltop.com',
      organizationId: 'org9',
      organizationName: 'Hilltop Barn',
      inviteUrl: 'https://app.example/invite',
      body: 'Hello with no link',
    })).rejects.toThrow(/inviteUrl/i);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
