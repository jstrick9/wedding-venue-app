/** Product from-address for transactional invites. Not a custom domain. */
export const TRANSACTIONAL_FROM_EMAIL = 'wedding-vip@outlook.com';
export const TRANSACTIONAL_FROM_NAME = 'Wedding VIP';

export function extractEmailAddress(value: string): string {
  const angled = String(value || '').match(/<([^>]+)>/);
  return (angled?.[1] || value || '').trim().toLowerCase();
}

/**
 * Always send as wedding-vip@outlook.com. A leftover EMAIL_FROM secret
 * (invites@weddingvip.com from the unused Resend domain) must not win.
 */
export function resolveTransactionalFromAddress(_emailFromSecret?: string | null): string {
  return TRANSACTIONAL_FROM_EMAIL;
}

export function describeBrevoSenderRejection(fromEmail: string, providerMessage = ''): string {
  const detail = providerMessage.trim();
  void fromEmail;
  void detail;
  return 'Email delivery is temporarily unavailable. Try again later or copy the invitation link instead.';
}
