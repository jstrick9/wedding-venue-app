import { describe, expect, it } from 'vitest';
import {
  TRANSACTIONAL_FROM_EMAIL,
  describeBrevoSenderRejection,
  extractEmailAddress,
  resolveTransactionalFromAddress,
} from './inviteFromAddress';

describe('inviteFromAddress', () => {
  it('always uses wedding-vip@outlook.com even if EMAIL_FROM is the old domain', () => {
    expect(resolveTransactionalFromAddress(undefined)).toBe(TRANSACTIONAL_FROM_EMAIL);
    expect(resolveTransactionalFromAddress('invites@weddingvip.com')).toBe('wedding-vip@outlook.com');
    expect(resolveTransactionalFromAddress('Wedding VIP <invites@weddingvip.com>')).toBe('wedding-vip@outlook.com');
    expect(extractEmailAddress('Wedding VIP <invites@weddingvip.com>')).toBe('invites@weddingvip.com');
  });

  it('hides delivery-provider details from the rendered failure', () => {
    const message = describeBrevoSenderRejection('wedding-vip@outlook.com', 'Sender not valid');
    expect(message).toMatch(/temporarily unavailable/i);
    expect(message).not.toMatch(/brevo|sender not valid|outlook/i);
  });
});
