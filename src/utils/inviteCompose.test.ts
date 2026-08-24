import { describe, expect, it } from 'vitest';
import {
  OUTLOOK_INVITE_FROM,
  buildMailtoHref,
  buildOutlookComposeHref,
} from './inviteCompose';

const message = {
  to: 'owner@hilltop.com',
  subject: 'You are invited to administer Hilltop Barn',
  body: 'Hello Ada Lovelace,\n\nSet up your account:\nhttps://weddingvip.vercel.app/?va=abc#/venue-onboarding',
};

describe('inviteCompose', () => {
  it('builds a mailto href with encoded subject and body', () => {
    const href = buildMailtoHref(message);
    expect(href.startsWith('mailto:owner%40hilltop.com?')).toBe(true);
    expect(href).toContain('subject=You%20are%20invited');
  });

  it('builds an Outlook.com compose link without plus-encoded spaces', () => {
    expect(OUTLOOK_INVITE_FROM).toBe('wedding-vip@outlook.com');
    const href = buildOutlookComposeHref(message);
    expect(href.startsWith('https://outlook.live.com/mail/0/deeplink/compose?')).toBe(true);
    expect(href).toContain('You%20are%20invited');
    expect(href).not.toContain('You+are+invited');
  });
});
