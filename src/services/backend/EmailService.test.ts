import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
const configuredMock = vi.fn(() => true);

vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({ functions: { invoke: (...args: unknown[]) => invokeMock(...args) } }),
  isSupabaseConfigured: () => configuredMock(),
}));

import { sendTransactionalEmail } from './EmailService';

describe('sendTransactionalEmail', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    configuredMock.mockReturnValue(true);
  });

  it('throws a configuration error when Supabase is not set up', async () => {
    configuredMock.mockReturnValue(false);
    await expect(sendTransactionalEmail({
      to: 'owner@hilltop.com',
      purpose: 'venue_admin_invite',
      organizationId: 'org9',
    })).rejects.toThrow(/supabase/i);
  });

  it('surfaces the Edge Function error body instead of a generic invoke message', async () => {
    invokeMock.mockResolvedValue({
      data: { error: 'Email service is not configured. Set SMTP_PASS for Outlook (wedding-vip@outlook.com) or RESEND_API_KEY + EMAIL_FROM.' },
      error: { message: 'Edge Function returned a non-2xx status code' },
    });
    await expect(sendTransactionalEmail({
      to: 'owner@hilltop.com',
      purpose: 'venue_admin_invite',
      organizationId: 'org9',
    })).rejects.toThrow(/SMTP_PASS/);
  });
});
