export const DEFAULT_VENUE_ADMIN_INVITE_SUBJECT = 'You are invited to administer {venueName}';

export const DEFAULT_VENUE_ADMIN_INVITE_BODY = `Hello,

{platformName} invited you to become the venue administrator for {venueName}.

Open this one-time setup link to create your password and claim the venue:
{inviteUrl}

This invitation is for {adminEmail} and expires {expiresAt}.

If you were not expecting this email, you can ignore it.`;

const TAG_RE = /\{(venueName|inviteUrl|adminEmail|expiresAt|platformName)\}/g;

export interface VenueAdminInviteVars {
  venueName: string;
  inviteUrl: string;
  adminEmail: string;
  expiresAt: string;
  platformName: string;
}

export function resolveVenueAdminInviteTemplate(subject?: string, body?: string): { subject: string; body: string } {
  return {
    subject: (subject || '').trim() || DEFAULT_VENUE_ADMIN_INVITE_SUBJECT,
    body: (body || '').trim() || DEFAULT_VENUE_ADMIN_INVITE_BODY,
  };
}

export function venueAdminInviteIncludesLink(body?: string): boolean {
  return /\{inviteUrl\}/.test(resolveVenueAdminInviteTemplate('', body).body);
}

export function applyVenueAdminInviteTemplate(
  subject: string | undefined,
  body: string | undefined,
  vars: VenueAdminInviteVars,
): { subject: string; body: string } {
  const resolved = resolveVenueAdminInviteTemplate(subject, body);
  const fill = (text: string) => text.replace(TAG_RE, (_, key: keyof VenueAdminInviteVars) => String(vars[key] ?? ''));
  return { subject: fill(resolved.subject), body: fill(resolved.body) };
}
