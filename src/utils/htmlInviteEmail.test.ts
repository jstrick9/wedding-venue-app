import { describe, expect, it } from 'vitest';
import {
  buildHtmlInviteDocument,
  buildUnsentHtmlEml,
  escapeHtml,
  inviteEmlFilename,
  renderEmailCtaButton,
} from './htmlInviteEmail';

describe('htmlInviteEmail', () => {
  it('builds an Outlook-ready unsent HTML eml with a button and no visible token URL', () => {
    const inviteUrl = 'https://weddingvip.vercel.app/#/venue-onboarding?token=secret-token';
    const html = buildHtmlInviteDocument({
      subject: 'You are invited to administer Seven Paths Manor',
      body: 'Hello Ada Lovelace,\n\nUse the button in this email to create your password.\n\nThis invitation is for owner@hilltop.com.',
      buttonUrl: inviteUrl,
      buttonLabel: 'Set up your account',
    });
    expect(html).toContain('Set up your account');
    expect(html).toContain(`href="${inviteUrl}"`);
    expect(html).not.toMatch(/>https:\/\/weddingvip\.vercel\.app\/#\/venue-onboarding\?token=secret-token</);
    expect(html).toContain('Hello Ada Lovelace,');

    const eml = buildUnsentHtmlEml({
      from: 'wedding-vip@outlook.com',
      fromLabel: 'Wedding VIP',
      to: 'owner@hilltop.com',
      subject: 'You are invited to administer Seven Paths Manor',
      text: `Hello Ada Lovelace,\n\nSet up your account:\n${inviteUrl}`,
      html,
    });
    expect(eml).toContain('X-Unsent: 1');
    expect(eml).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(eml).toContain('Set up your account');
    expect(eml).toContain('From: Wedding VIP <wedding-vip@outlook.com>');
    expect(eml).toContain('To: owner@hilltop.com');
    expect(inviteEmlFilename('Invite Seven Paths Manor')).toBe('invite-seven-paths-manor.eml');
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(renderEmailCtaButton(inviteUrl, 'Set up your account')).toContain(inviteUrl);
  });
});
