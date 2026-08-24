/** Mailbox shown as the platform invite from-address. */
export const OUTLOOK_INVITE_FROM = 'wedding-vip@outlook.com';
export const OUTLOOK_INVITE_FROM_LABEL = 'Wedding VIP';

export interface InviteComposeMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
  filename?: string;
}

export function buildMailtoHref(message: InviteComposeMessage): string {
  const to = message.to.trim();
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
}

/**
 * Outlook.com web compose. Spaces use %20. URLSearchParams would use +, and
 * Outlook.com displays those plus signs literally. Body is plain text only.
 */
export function buildOutlookComposeHref(message: InviteComposeMessage): string {
  const params = [
    `to=${encodeURIComponent(message.to.trim())}`,
    `subject=${encodeURIComponent(message.subject)}`,
    `body=${encodeURIComponent(message.body)}`,
  ].join('&');
  return `https://outlook.live.com/mail/0/deeplink/compose?${params}`;
}
