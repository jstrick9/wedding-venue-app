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

  it('sends a venue_admin_invite with a named greeting and no visible token in the template body', async () => {
    await sendVenueAdminInviteEmail({
      to: 'owner@hilltop.com',
      organizationId: 'org9',
      organizationName: 'Hilltop Barn',
      inviteUrl: 'https://app.example/#/venue-onboarding?token=abc',
      expiresAt: '2026-08-27T00:00:00.000Z',
      platformName: 'Platform',
      contactFirstName: 'Ada',
      contactLastName: 'Lovelace',
    });
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@hilltop.com',
      purpose: 'venue_admin_invite',
      organizationId: 'org9',
    }));
    const data = sendMock.mock.calls[0][0].templateData;
    expect(data.body).toContain('Hello Ada Lovelace,');
    expect(data.body).toContain('Hilltop Barn');
    expect(data.inviteUrl).toBe('https://app.example/#/venue-onboarding?token=abc');
    expect(data.contactFirstName).toBe('Ada');
    expect(data.contactLastName).toBe('Lovelace');
  });

  it('still sends when a custom template omits {inviteUrl}', async () => {
    await sendVenueAdminInviteEmail({
      to: 'owner@hilltop.com',
      organizationId: 'org9',
      organizationName: 'Hilltop Barn',
      inviteUrl: 'https://app.example/invite',
      body: 'Hello with no link',
      contactFirstName: 'Ada',
      contactLastName: 'Lovelace',
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].templateData.inviteUrl).toBe('https://app.example/invite');
  });

  it('does not open Outlook when transactional send fails', async () => {
    sendMock.mockRejectedValueOnce(new Error('Email service is not configured'));
    const open = vi.fn();
    vi.stubGlobal('open', open);
    await expect(deliverVenueAdminInvite({
      to: 'owner@hilltop.com',
      organizationId: 'org9',
      organizationName: 'Hilltop Barn',
      inviteUrl: 'https://app.example/#/venue-onboarding?token=abc',
    })).rejects.toThrow(/not configured/i);
    expect(open).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
