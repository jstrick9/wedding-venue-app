/** Mailbox used to send platform invites until weddingvip.com is verified. */
export const OUTLOOK_INVITE_FROM = 'wedding-vip@outlook.com';
export const OUTLOOK_INVITE_FROM_LABEL = 'Wedding VIP';

export interface InviteComposeMessage {
  to: string;
  subject: string;
  body: string;
}

export function buildMailtoHref(message: InviteComposeMessage): string {
  const to = message.to.trim();
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
}

/**
 * Outlook.com web compose for the personal wedding-vip@outlook.com mailbox.
 * Uses encodeURIComponent (spaces as %20). URLSearchParams would use +, and
 * Outlook.com displays those plus signs literally.
 */
export function buildOutlookComposeHref(message: InviteComposeMessage): string {
  const params = [
    `to=${encodeURIComponent(message.to.trim())}`,
    `subject=${encodeURIComponent(message.subject)}`,
    `body=${encodeURIComponent(message.body)}`,
  ].join('&');
  return `https://outlook.live.com/mail/0/deeplink/compose?${params}`;
}

/**
 * Open a prefilled Outlook compose window. If the popup is blocked (common
 * after an async invite create), fall back to mailto so the system mail app
 * (Outlook desktop if it is the default) still opens.
 */
export function openOutlookInviteCompose(message: InviteComposeMessage): 'outlook' | 'mailto' {
  if (typeof window === 'undefined') return 'mailto';
  const outlook = buildOutlookComposeHref(message);
  try {
    const popup = window.open(outlook, '_blank', 'noopener,noreferrer');
    if (popup) return 'outlook';
  } catch {
    // fall through to mailto
  }
  window.location.href = buildMailtoHref(message);
  return 'mailto';
}
