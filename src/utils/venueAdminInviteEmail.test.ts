import { describe, expect, it } from 'vitest';
import {
  applyVenueAdminInviteTemplate,
  DEFAULT_VENUE_ADMIN_INVITE_BODY,
  venueAdminInviteIncludesLink,
} from './venueAdminInviteEmail';

describe('venueAdminInviteEmail', () => {
  it('fills merge tags and requires an invite URL placeholder', () => {
    const applied = applyVenueAdminInviteTemplate(undefined, undefined, {
      venueName: 'Hilltop Barn',
      inviteUrl: 'https://app.example/#/venue-onboarding?token=abc',
      adminEmail: 'owner@hilltop.com',
      expiresAt: 'Aug 26, 2026',
      platformName: 'Platform',
    });
    expect(applied.subject).toContain('Hilltop Barn');
    expect(applied.body).toContain('https://app.example/#/venue-onboarding?token=abc');
    expect(applied.body).toContain('owner@hilltop.com');
    expect(venueAdminInviteIncludesLink(DEFAULT_VENUE_ADMIN_INVITE_BODY)).toBe(true);
    expect(venueAdminInviteIncludesLink('Hello only')).toBe(false);
  });
});
