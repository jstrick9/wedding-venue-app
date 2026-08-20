import { sendTransactionalEmail } from '../backend/EmailService';
import { applyVenueAdminInviteTemplate, venueAdminInviteIncludesLink } from '../../utils/venueAdminInviteEmail';

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

export async function sendVenueAdminInviteEmail(input: SendVenueAdminInviteEmailInput): Promise<void> {
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
