import {
  applyVenueAdminInviteTemplate,
  buildVenueAdminInviteHtml,
  ensureInviteUrlInPlainText,
} from '../../utils/venueAdminInviteEmail';
import { inviteEmlFilename } from '../../utils/htmlInviteEmail';
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
    html: buildVenueAdminInviteHtml(applied.body, input.inviteUrl, applied.subject),
    filename: inviteEmlFilename(`invite-${input.organizationName}`),
  };
}
