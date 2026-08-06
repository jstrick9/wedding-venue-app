import { sendTransactionalEmail, buildInvitationTemplateData } from '../backend/EmailService';
import { getPlatformProvider } from '../platform';
import { isSupabaseConfigured } from '../backend/supabaseClient';

export type CoupleEmailKind =
  | 'couple_invite'       // invite a collaborator to the couples portal
  | 'guest_invite'        // invite a guest to the guest portal
  | 'guest_reminder';     // remind a guest who hasn't RSVP'd

/**
 * Try to send a real transactional email when the Supabase backend is configured.
 * Returns 'sent' if delivered, 'mailto' if it fell back (Supabase not configured,
 * or the send failed), and 'none' if there's no recipient.
 */
export async function sendCoupleEmail(
  email: string | undefined,
  opts: {
    name: string;
    url: string;
    coupleName: string;
    kind: CoupleEmailKind;
    organizationId: string;
    subject: string;
    body: string;
  },
): Promise<'sent' | 'mailto' | 'none'> {
  const to = email?.trim();
  if (!to) return 'none';

  const purpose =
    opts.kind === 'guest_reminder' ? ('rsvp_confirmation' as const) : ('invitation' as const);

  const canSendTransactional =
    getPlatformProvider() === 'supabase' &&
    isSupabaseConfigured() &&
    Boolean(opts.organizationId.trim());

  if (canSendTransactional) {
    try {
      await sendTransactionalEmail({
        to,
        purpose,
        organizationId: opts.organizationId,
        templateData: buildInvitationTemplateData({
          recipientName: opts.name,
          organizationName: opts.coupleName,
          inviteUrl: opts.url,
        }),
      });
      return 'sent';
    } catch {
      // Fall through to mailto on any delivery error.
    }
  }

  // Mailto fallback (local mode or email failure).
  const mailto = `mailto:${to}?subject=${encodeURIComponent(opts.subject)}&body=${encodeURIComponent(opts.body)}`;
  window.location.href = mailto;
  return 'mailto';
}
