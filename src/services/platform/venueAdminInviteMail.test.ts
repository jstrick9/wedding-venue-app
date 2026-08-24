import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('../backend/EmailService', () => ({
  sendTransactionalEmail: (...args: unknown[]) => sendMock(...args),
}));

import { buildVenueAdminInviteCompose, deliverVenueAdminInvite } from './venueAdminInviteMail';
import { VENUE_ADMIN_SETUP_BUTTON_LABEL } from '../../utils/venueAdminInviteEmail';

describe('venueAdminInviteMail', () => {
  beforeEach(() => {
    sendMock.mockReset().mockResolvedValue(undefined);
  });

  it('builds HTML with a named greeting and a Set up your account button', () => {
    const compose = buildVenueAdminInviteCompose({
      to: 'owner@hilltop.com',
      organizationId: 'org9',
      organizationName: 'Hilltop Barn',
      inviteUrl: 'https://weddingvip.vercel.app/?va=abc#/venue-onboarding',
      expiresAt: '2026-08-27T00:00:00.000Z',
      platformName: 'Platform',
      contactFirstName: 'Ada',
      contactLastName: 'Lovelace',
    });
    expect(compose.subject).toContain('Hilltop Barn');
    expect(compose.body).toContain('Hello Ada Lovelace,');
    expect(compose.html).toContain(VENUE_ADMIN_SETUP_BUTTON_LABEL);
    expect(compose.html).toContain('href="https://weddingvip.vercel.app/?va=abc#/venue-onboarding"');
  });

  it('sends the same HTML document through the email function', async () => {
    const input = {
      to: 'owner@hilltop.com',
      organizationId: 'org9',
      organizationName: 'Hilltop Barn',
      inviteUrl: 'https://weddingvip.vercel.app/?va=abc#/venue-onboarding',
      contactFirstName: 'Ada',
      contactLastName: 'Lovelace',
    };
    await expect(deliverVenueAdminInvite(input)).resolves.toBe('sent');
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      purpose: 'venue_admin_invite',
      to: 'owner@hilltop.com',
    }));
    expect(sendMock.mock.calls[0][0].templateData.html).toContain(VENUE_ADMIN_SETUP_BUTTON_LABEL);
  });
});
