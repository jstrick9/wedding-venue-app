import { sendTransactionalEmail } from '../backend/EmailService';
import { applyVenueAdminInviteTemplate, venueAdminInviteIncludesLink } from '../../utils/venueAdminInviteEmail';
import { openOutlookInviteCompose, type InviteComposeMessage } from '../../utils/inviteCompose';

export interface SendVenueAdminInviteEmailInput {
  to: string;
  organizationId: string;
  organizationName: string;
  inviteUrl: string;
  expiresAt?: string;
  platformName?: string;
  subject?: string;
  body?: string;
}

export function buildVenueAdminInviteCompose(input: SendVenueAdminInviteEmailInput): InviteComposeMessage {
  if (!venueAdminInviteIncludesLink(input.body)) {
    throw new Error('The invite email template must include {inviteUrl}.');
  }
  const applied = applyVenueAdminInviteTemplate(input.subject, input.body, {
    venueName: input.organizationName,
    inviteUrl: input.inviteUrl,
    adminEmail: input.to,
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toLocaleString() : 'in 7 days',
    platformName: input.platformName || 'the platform',
  });
  return { to: input.to, subject: applied.subject, body: applied.body };
}

/** Send via the Edge Function (Outlook SMTP / Resend). On failure, open Outlook compose. */
export async function deliverVenueAdminInvite(input: SendVenueAdminInviteEmailInput): Promise<'sent' | 'outlook' | 'mailto'> {
  const compose = buildVenueAdminInviteCompose(input);
  try {
    await sendVenueAdminInviteEmail(input);
    return 'sent';
  } catch {
    return openOutlookInviteCompose(compose);
  }
}

export async function sendVenueAdminInviteEmail(input: SendVenueAdminInviteEmailInput): Promise<void> {
  const applied = buildVenueAdminInviteCompose(input);
  await sendTransactionalEmail({
    to: input.to,
    purpose: 'venue_admin_invite',
    organizationId: input.organizationId,
    templateData: {
      subject: applied.subject,
      body: applied.body,
      inviteUrl: input.inviteUrl,
      organizationName: input.organizationName,
      recipientName: input.to,
    },
  });
}
