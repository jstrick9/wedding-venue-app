import { describe, expect, it } from 'vitest';
import {
  buildHtmlInviteDocument,
  escapeHtml,
  renderEmailCtaButton,
} from './htmlInviteEmail';

describe('htmlInviteEmail', () => {
  it('builds HTML with a button and no visible token URL', () => {
    const inviteUrl = 'https://weddingvip.vercel.app/?va=secret-token#/venue-onboarding';
    const html = buildHtmlInviteDocument({
      subject: 'You are invited to administer Seven Paths Manor',
      body: 'Hello Ada Lovelace,\n\nUse the button in this email to create your password.\n\nThis invitation is for owner@hilltop.com.',
      buttonUrl: inviteUrl,
      buttonLabel: 'Set up your account',
    });
    expect(html).toContain('Set up your account');
    expect(html).toContain(`href="${inviteUrl}"`);
    expect(html).not.toMatch(/>https:\/\/weddingvip\.vercel\.app\/\?va=secret-token#\/venue-onboarding</);
    expect(html).toContain('Hello Ada Lovelace,');
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(renderEmailCtaButton(inviteUrl, 'Set up your account')).toContain(inviteUrl);
  });
});
