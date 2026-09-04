import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
const configuredMock = vi.fn(() => true);

vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({ functions: { invoke: (...args: unknown[]) => invokeMock(...args) } }),
  isSupabaseConfigured: () => configuredMock(),
}));

import { describeEmailDeliveryFailure, sendTransactionalEmail } from './EmailService';

describe('sendTransactionalEmail', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    configuredMock.mockReturnValue(true);
  });

  it('returns a white-label availability message when delivery is not configured', async () => {
    configuredMock.mockReturnValue(false);
    await expect(sendTransactionalEmail({
      to: 'owner@hilltop.com',
      purpose: 'venue_admin_invite',
      organizationId: 'org9',
    })).rejects.toThrow(/temporarily unavailable/i);
  });

  it('never surfaces a raw function error body', async () => {
    invokeMock.mockResolvedValue({
      data: { error: 'Email service is not configured. Set BREVO_API_KEY on the send-email function.' },
      error: { message: 'Edge Function returned a non-2xx status code' },
    });
    await expect(sendTransactionalEmail({
      to: 'owner@hilltop.com',
      purpose: 'venue_admin_invite',
      organizationId: 'org9',
    })).rejects.toThrow(/temporarily unavailable/i);
  });

  it('hides transport and sender details from browser failures', () => {
    const network = describeEmailDeliveryFailure({ message: 'Failed to send a request to the Edge Function' });
    const sender = describeEmailDeliveryFailure({ message: 'Sender invites@weddingvip.com is not valid' });
    expect(network).toMatch(/temporarily unavailable/i);
    expect(sender).toMatch(/temporarily unavailable/i);
    expect(`${network} ${sender}`).not.toMatch(/brevo|edge function|outlook|sender/i);
  });
});
