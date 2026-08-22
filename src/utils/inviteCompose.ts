import {
  buildUnsentHtmlEml,
  downloadUnsentHtmlEml,
  inviteEmlFilename,
  wrapInviteHtml,
  paragraphsToHtml,
} from './htmlInviteEmail';

/** Mailbox used when the operator opens or downloads an Outlook invite draft. */
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
 * Outlook.com web compose for the personal wedding-vip@outlook.com mailbox.
 * Uses encodeURIComponent (spaces as %20). URLSearchParams would use +, and
 * Outlook.com displays those plus signs literally. This is plain text only —
 * Outlook.com compose cannot render an HTML button.
 */
export function buildOutlookComposeHref(message: InviteComposeMessage): string {
  const params = [
    `to=${encodeURIComponent(message.to.trim())}`,
    `subject=${encodeURIComponent(message.subject)}`,
    `body=${encodeURIComponent(message.body)}`,
  ].join('&');
  return `https://outlook.live.com/mail/0/deeplink/compose?${params}`;
}

export function resolveInviteHtml(message: InviteComposeMessage): string {
  if (message.html?.trim()) return message.html;
  return wrapInviteHtml(message.subject, paragraphsToHtml(message.body));
}

/** Build the HTML .eml draft the operator opens in Outlook and sends. */
export function buildOutlookHtmlInviteEml(message: InviteComposeMessage): string {
  return buildUnsentHtmlEml({
    from: OUTLOOK_INVITE_FROM,
    fromLabel: OUTLOOK_INVITE_FROM_LABEL,
    to: message.to,
    subject: message.subject,
    text: message.body,
    html: resolveInviteHtml(message),
  });
}

/**
 * Download a ready-to-send Outlook draft (.eml, X-Unsent) with the HTML button.
 * Outlook.com compose cannot send HTML, so this is the manual send path.
 */
export function openOutlookInviteCompose(message: InviteComposeMessage): 'eml' {
  downloadUnsentHtmlEml({
    from: OUTLOOK_INVITE_FROM,
    fromLabel: OUTLOOK_INVITE_FROM_LABEL,
    to: message.to,
    subject: message.subject,
    text: message.body,
    html: resolveInviteHtml(message),
    filename: message.filename || inviteEmlFilename(message.subject),
  });
  return 'eml';
}
