import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/backend/EmailService', () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue(undefined),
  buildInvitationTemplateData: (p: unknown) => p,
}));
vi.mock('../platform', () => ({
  getPlatformProvider: vi.fn(() => 'local'),
}));
vi.mock('../backend/supabaseClient', () => ({
  isSupabaseConfigured: vi.fn(() => false),
}));

import { sendCoupleEmail } from './coupleEmailService';
import { sendTransactionalEmail } from '../../services/backend/EmailService';
import { getPlatformProvider } from '../platform';
import { isSupabaseConfigured } from '../backend/supabaseClient';

const base = {
  name: 'Jane',
  url: 'https://x.test/#/guest-portal?token=abc',
  coupleName: 'Smith Wedding',
  organizationId: 'org-1',
  subject: 'RSVP for Smith Wedding',
  body: 'Hi Jane',
};

describe('coupleEmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to mailto when Supabase is not configured (local mode)', async () => {
    vi.mocked(getPlatformProvider).mockReturnValue('local');
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    const res = await sendCoupleEmail('jane@example.com', { ...base, kind: 'guest_invite' });
    expect(res).toBe('mailto');
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it('sends transactionally when Supabase provider is configured with an org id', async () => {
    vi.mocked(getPlatformProvider).mockReturnValue('supabase');
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    const res = await sendCoupleEmail('jane@example.com', { ...base, kind: 'guest_invite' });
    expect(res).toBe('sent');
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'jane@example.com', purpose: 'invitation' }),
    );
  });

  it('falls back to mailto when there is no organization id', async () => {
    vi.mocked(getPlatformProvider).mockReturnValue('supabase');
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    const res = await sendCoupleEmail('jane@example.com', { ...base, organizationId: '', kind: 'guest_invite' });
    expect(res).toBe('mailto');
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it('falls back to mailto when the transactional send throws', async () => {
    vi.mocked(getPlatformProvider).mockReturnValue('supabase');
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(sendTransactionalEmail).mockRejectedValueOnce(new Error('delivery failed'));
    const res = await sendCoupleEmail('jane@example.com', { ...base, kind: 'guest_reminder' });
    expect(res).toBe('mailto');
  });

  it('returns none when there is no recipient', async () => {
    const res = await sendCoupleEmail('', { ...base, kind: 'guest_invite' });
    expect(res).toBe('none');
  });
});
