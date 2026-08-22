import { sendTransactionalEmail } from '../backend/EmailService';
import {
  applyVenueAdminInviteTemplate,
  ensureInviteUrlInPlainText,
  joinContactName,
} from '../../utils/venueAdminInviteEmail';
import type { InviteComposeMessage } from '../../utils/inviteCompose';

export interface SendVenueAdminInviteEmailInput {
  to: string;
  organizationId: string;
  organizationName: string;
  inviteUrl: string;
  expiresAt?: string;
  platformName?: string;
  subject?: string;
  body?: string;
  contactFirstName?: string;
  contactLastName?: string;
}

export function buildVenueAdminInviteCompose(input: SendVenueAdminInviteEmailInput): InviteComposeMessage {
  const applied = applyVenueAdminInviteTemplate(input.subject, input.body, {
    venueName: input.organizationName,
    inviteUrl: input.inviteUrl,
    adminEmail: input.to,
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toLocaleString() : 'in 7 days',
    platformName: input.platformName || 'the platform',
    contactFirstName: input.contactFirstName,
    contactLastName: input.contactLastName,
  });
  return {
    to: input.to,
    subject: applied.subject,
    body: ensureInviteUrlInPlainText(applied.body, input.inviteUrl),
  };
}

/** Send via the Edge Function (Outlook SMTP / Resend). Does not open Outlook. */
export async function deliverVenueAdminInvite(input: SendVenueAdminInviteEmailInput): Promise<'sent'> {
  await sendVenueAdminInviteEmail(input);
  return 'sent';
}

export async function sendVenueAdminInviteEmail(input: SendVenueAdminInviteEmailInput): Promise<void> {
  const applied = buildVenueAdminInviteCompose(input);
  const contactName = joinContactName(input.contactFirstName, input.contactLastName);
  await sendTransactionalEmail({
    to: input.to,
    purpose: 'venue_admin_invite',
    organizationId: input.organizationId,
    templateData: {
      subject: applied.subject,
      body: applied.body,
      inviteUrl: input.inviteUrl,
      organizationName: input.organizationName,
      recipientName: contactName || input.to,
      contactFirstName: (input.contactFirstName || '').trim(),
      contactLastName: (input.contactLastName || '').trim(),
      contactName,
    },
  });
}
