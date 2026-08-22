import { buildHtmlInviteDocument } from './htmlInviteEmail';

export const VENUE_ADMIN_SETUP_BUTTON_LABEL = 'Set up your account';

export const DEFAULT_VENUE_ADMIN_INVITE_SUBJECT = 'You are invited to administer {venueName}';

export const DEFAULT_VENUE_ADMIN_INVITE_BODY = `Hello {contactName},

{platformName} invited you to become the venue administrator for {venueName}.

Use the button in this email to create your password and claim the venue.

This invitation is for {adminEmail} and expires {expiresAt}.

If you were not expecting this email, you can ignore it.`;

const TAG_RE = /\{(venueName|inviteUrl|adminEmail|expiresAt|platformName|contactName|contactFirstName|contactLastName)\}/g;

export interface VenueAdminInviteVars {
  venueName: string;
  inviteUrl: string;
  adminEmail: string;
  expiresAt: string;
  platformName: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactName?: string;
}

export function joinContactName(firstName?: string, lastName?: string): string {
  return [firstName, lastName].map((part) => (part || '').trim()).filter(Boolean).join(' ');
}

export function splitContactName(fullName?: string): { firstName: string; lastName: string } {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const space = trimmed.indexOf(' ');
  if (space === -1) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1).trim() };
}

export function formatContactGreeting(firstName?: string, lastName?: string): string {
  const name = joinContactName(firstName, lastName);
  return name ? `Hello ${name},` : 'Hello,';
}

export function applyContactGreeting(body: string, firstName?: string, lastName?: string): string {
  const greeting = formatContactGreeting(firstName, lastName);
  if (/^Hello\b[^\n]*,/m.test(body)) return body.replace(/^Hello\b[^\n]*,/m, greeting);
  return `${greeting}\n\n${body.replace(/^\s+/, '')}`;
}

export function resolveVenueAdminInviteTemplate(subject?: string, body?: string): { subject: string; body: string } {
  return {
    subject: (subject || '').trim() || DEFAULT_VENUE_ADMIN_INVITE_SUBJECT,
    body: (body || '').trim() || DEFAULT_VENUE_ADMIN_INVITE_BODY,
  };
}

export function venueAdminInviteIncludesLink(body?: string): boolean {
  const text = resolveVenueAdminInviteTemplate('', body).body;
  return /\{inviteUrl\}/.test(text) || !(body || '').trim();
}

export function applyVenueAdminInviteTemplate(
  subject: string | undefined,
  body: string | undefined,
  vars: VenueAdminInviteVars,
): { subject: string; body: string } {
  const resolved = resolveVenueAdminInviteTemplate(subject, body);
  const contactFirstName = (vars.contactFirstName || '').trim();
  const contactLastName = (vars.contactLastName || '').trim();
  const contactName = (vars.contactName || '').trim() || joinContactName(contactFirstName, contactLastName);
  const filled: Required<VenueAdminInviteVars> = {
    venueName: vars.venueName,
    inviteUrl: vars.inviteUrl,
    adminEmail: vars.adminEmail,
    expiresAt: vars.expiresAt,
    platformName: vars.platformName,
    contactFirstName,
    contactLastName,
    contactName,
  };
  const fill = (text: string) => text.replace(TAG_RE, (_, key: keyof Required<VenueAdminInviteVars>) => String(filled[key] ?? ''));
  return {
    subject: fill(resolved.subject),
    body: applyContactGreeting(fill(resolved.body), contactFirstName, contactLastName),
  };
}

export function ensureInviteUrlInPlainText(body: string, inviteUrl: string): string {
  if (!inviteUrl || body.includes(inviteUrl)) return body;
  return `${body.trim()}\n\n${VENUE_ADMIN_SETUP_BUTTON_LABEL}:\n${inviteUrl}`;
}

export function buildVenueAdminInviteHtml(body: string, inviteUrl: string, subject: string): string {
  return buildHtmlInviteDocument({
    subject,
    body,
    buttonUrl: inviteUrl,
    buttonLabel: VENUE_ADMIN_SETUP_BUTTON_LABEL,
  });
}
