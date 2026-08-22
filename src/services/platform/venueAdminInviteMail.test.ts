import { describe, expect, it } from 'vitest';
import { buildVenueAdminInviteCompose } from './venueAdminInviteMail';
import { VENUE_ADMIN_SETUP_BUTTON_LABEL } from '../../utils/venueAdminInviteEmail';

describe('buildVenueAdminInviteCompose', () => {
  it('builds HTML with a named greeting and a Set up your account button', () => {
    const compose = buildVenueAdminInviteCompose({
      to: 'owner@hilltop.com',
      organizationId: 'org9',
      organizationName: 'Hilltop Barn',
      inviteUrl: 'https://app.example/#/venue-onboarding?token=abc',
      expiresAt: '2026-08-27T00:00:00.000Z',
      platformName: 'Platform',
      contactFirstName: 'Ada',
      contactLastName: 'Lovelace',
    });
    expect(compose.to).toBe('owner@hilltop.com');
    expect(compose.subject).toContain('Hilltop Barn');
    expect(compose.body).toContain('Hello Ada Lovelace,');
    expect(compose.body).toContain(VENUE_ADMIN_SETUP_BUTTON_LABEL);
    expect(compose.html).toContain('Hello Ada Lovelace,');
    expect(compose.html).toContain(VENUE_ADMIN_SETUP_BUTTON_LABEL);
    expect(compose.html).toContain('href="https://app.example/#/venue-onboarding?token=abc"');
    expect(compose.html).not.toMatch(/>https:\/\/app\.example\/#\/venue-onboarding\?token=abc</);
    expect(compose.filename).toBe('invite-hilltop-barn.eml');
  });

  it('still injects the button when a custom template omits {inviteUrl}', () => {
    const compose = buildVenueAdminInviteCompose({
      to: 'owner@hilltop.com',
      organizationId: 'org9',
      organizationName: 'Hilltop Barn',
      inviteUrl: 'https://app.example/invite',
      body: 'Hello with no link',
      contactFirstName: 'Ada',
      contactLastName: 'Lovelace',
    });
    expect(compose.html).toContain('href="https://app.example/invite"');
    expect(compose.html).toContain(VENUE_ADMIN_SETUP_BUTTON_LABEL);
  });
});
