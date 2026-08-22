import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('../backend/EmailService', () => ({
  sendTransactionalEmail: (...args: unknown[]) => sendMock(...args),
}));

import { deliverVenueAdminInvite, sendVenueAdminInviteEmail } from './venueAdminInviteMail';

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

  it('opens Outlook compose when transactional send fails', async () => {
    sendMock.mockRejectedValueOnce(new Error('Email service is not configured'));
    const popup = { closed: false } as Window;
    const open = vi.fn(() => popup);
    vi.stubGlobal('open', open);
    const result = await deliverVenueAdminInvite({
      to: 'owner@hilltop.com',
      organizationId: 'org9',
      organizationName: 'Hilltop Barn',
      inviteUrl: 'https://app.example/#/venue-onboarding?token=abc',
    });
    expect(result).toBe('outlook');
    expect(open).toHaveBeenCalledTimes(1);
    const firstCall = open.mock.calls[0] as unknown as [string, string, string];
    const href = String(firstCall[0]);
    expect(href.startsWith('https://outlook.live.com/mail/0/deeplink/compose?')).toBe(true);
    expect(href).toContain(encodeURIComponent('owner@hilltop.com'));
    expect(href).toContain(encodeURIComponent('#/venue-onboarding?token=abc'));
    vi.unstubAllGlobals();
  });
});
