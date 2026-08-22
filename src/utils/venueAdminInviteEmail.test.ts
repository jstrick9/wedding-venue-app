import { describe, expect, it } from 'vitest';
import {
  applyContactGreeting,
  applyVenueAdminInviteTemplate,
  buildVenueAdminInviteHtml,
  DEFAULT_VENUE_ADMIN_INVITE_BODY,
  ensureInviteUrlInPlainText,
  formatContactGreeting,
  joinContactName,
  splitContactName,
  venueAdminInviteIncludesLink,
  VENUE_ADMIN_SETUP_BUTTON_LABEL,
} from './venueAdminInviteEmail';

describe('venueAdminInviteEmail', () => {
  it('fills merge tags including the contact greeting', () => {
    const applied = applyVenueAdminInviteTemplate(undefined, undefined, {
      venueName: 'Hilltop Barn',
      inviteUrl: 'https://app.example/#/venue-onboarding?token=abc',
      adminEmail: 'owner@hilltop.com',
      expiresAt: 'Aug 26, 2026',
      platformName: 'Platform',
      contactFirstName: 'Ada',
      contactLastName: 'Lovelace',
    });
    expect(applied.subject).toContain('Hilltop Barn');
    expect(applied.body).toContain('Hello Ada Lovelace,');
    expect(applied.body).toContain('owner@hilltop.com');
    expect(applied.body).not.toContain('{contactName}');
    expect(applied.body).not.toContain('https://app.example/#/venue-onboarding?token=abc');
    expect(venueAdminInviteIncludesLink(DEFAULT_VENUE_ADMIN_INVITE_BODY)).toBe(false);
    expect(venueAdminInviteIncludesLink('')).toBe(true);
    expect(venueAdminInviteIncludesLink('Hello {inviteUrl}')).toBe(true);
  });

  it('rewrites a legacy Hello, greeting when names are provided', () => {
    expect(formatContactGreeting('Joshua', 'Strickland')).toBe('Hello Joshua Strickland,');
    expect(applyContactGreeting('Hello,\n\nWelcome.', 'Joshua', 'Strickland')).toBe('Hello Joshua Strickland,\n\nWelcome.');
    expect(joinContactName('Joshua', 'Strickland')).toBe('Joshua Strickland');
    expect(splitContactName('Joshua Strickland')).toEqual({ firstName: 'Joshua', lastName: 'Strickland' });
    expect(ensureInviteUrlInPlainText('Hello Joshua,', 'https://example/invite')).toContain(VENUE_ADMIN_SETUP_BUTTON_LABEL);
    const html = buildVenueAdminInviteHtml('Hello Joshua Strickland,\n\nClaim the venue.', 'https://example/invite', 'Invite');
    expect(html).toContain(VENUE_ADMIN_SETUP_BUTTON_LABEL);
    expect(html).toContain('href="https://example/invite"');
    expect(html).not.toMatch(/>https:\/\/example\/invite</);
  });
});
