import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OUTLOOK_INVITE_FROM,
  buildMailtoHref,
  buildOutlookComposeHref,
  buildOutlookHtmlInviteEml,
  openOutlookInviteCompose,
} from './inviteCompose';

const message = {
  to: 'owner@hilltop.com',
  subject: 'You are invited to administer Hilltop Barn',
  body: 'Hello Ada Lovelace,\n\nSet up your account:\nhttps://app.example/#/venue-onboarding?token=abc',
  html: '<p>Hello Ada Lovelace,</p><a href="https://app.example/#/venue-onboarding?token=abc">Set up your account</a>',
  filename: 'invite-hilltop-barn.eml',
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

  it('builds an Outlook.com compose link without plus-encoded spaces', () => {
    expect(OUTLOOK_INVITE_FROM).toBe('wedding-vip@outlook.com');
    const href = buildOutlookComposeHref(message);
    expect(href.startsWith('https://outlook.live.com/mail/0/deeplink/compose?')).toBe(true);
    expect(href).not.toContain('mail.google.com');
    expect(href).toContain('You%20are%20invited');
    expect(href).not.toContain('You+are+invited');
    const parsed = new URL(href);
    expect(parsed.searchParams.get('to')).toBe('owner@hilltop.com');
    expect(parsed.searchParams.get('subject')).toBe(message.subject);
    expect(parsed.searchParams.get('body')).toContain('#/venue-onboarding?token=abc');
  });

  it('builds an unsent HTML eml with the invite button', () => {
    const eml = buildOutlookHtmlInviteEml(message);
    expect(eml).toContain('X-Unsent: 1');
    expect(eml).toContain('Set up your account');
    expect(eml).toContain('wedding-vip@outlook.com');
    expect(eml).toContain('Content-Type: text/html; charset="UTF-8"');
  });

  it('downloads the HTML Outlook draft when Send with Outlook is clicked', () => {
    const click = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:invite',
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      rel: '',
      click,
      remove,
    } as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    expect(openOutlookInviteCompose(message)).toBe('eml');
    expect(click).toHaveBeenCalledTimes(1);
  });
});
