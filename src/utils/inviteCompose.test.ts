import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OUTLOOK_INVITE_FROM,
  buildMailtoHref,
  buildOutlookComposeHref,
  openOutlookInviteCompose,
} from './inviteCompose';

const message = {
  to: 'owner@hilltop.com',
  subject: 'You are invited to administer Hilltop Barn',
  body: 'Open https://app.example/#/venue-onboarding?token=abc',
};

describe('inviteCompose', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('builds a mailto href with encoded subject and body', () => {
    const href = buildMailtoHref(message);
    expect(href.startsWith('mailto:owner%40hilltop.com?')).toBe(true);
    expect(href).toContain('subject=You%20are%20invited');
    expect(href).toContain('token%3Dabc');
  });

  it('builds an Outlook.com compose link for wedding-vip@outlook.com delivery', () => {
    expect(OUTLOOK_INVITE_FROM).toBe('wedding-vip@outlook.com');
    const href = buildOutlookComposeHref(message);
    expect(href.startsWith('https://outlook.live.com/mail/0/deeplink/compose?')).toBe(true);
    expect(href).not.toContain('mail.google.com');
    const parsed = new URL(href);
    expect(parsed.searchParams.get('to')).toBe('owner@hilltop.com');
    expect(parsed.searchParams.get('subject')).toBe(message.subject);
    expect(parsed.searchParams.get('body')).toContain('#/venue-onboarding?token=abc');
  });

  it('opens Outlook in a new tab when the popup is allowed', () => {
    const popup = { closed: false } as Window;
    const open = vi.fn(() => popup);
    vi.stubGlobal('open', open);
    expect(openOutlookInviteCompose(message)).toBe('outlook');
    expect(open).toHaveBeenCalledWith(
      buildOutlookComposeHref(message),
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('falls back to mailto when Outlook compose is blocked', () => {
    vi.stubGlobal('open', vi.fn(() => null));
    const assign = vi.fn();
    const original = window.location.href;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: original },
    });
    const loc = window.location as { href: string };
    Object.defineProperty(loc, 'href', {
      configurable: true,
      set: assign,
      get: () => original,
    });
    expect(openOutlookInviteCompose(message)).toBe('mailto');
    expect(assign).toHaveBeenCalledWith(buildMailtoHref(message));
  });
});
