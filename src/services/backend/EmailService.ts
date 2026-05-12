import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export type EmailPurpose =
  | 'invitation'
  | 'password_reset'
  | 'rsvp_confirmation'
  | 'staff_notification'
  | 'generic';

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  purpose?: EmailPurpose;
  organizationId?: string;
  eventId?: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Email delivery requires Supabase Edge Functions configuration.');
  }

  const { error } = await getSupabaseClient().functions.invoke('send-email', {
    body: params,
  });

  if (error) throw error;
}

export function buildInvitationEmail(params: {
  recipientName: string;
  organizationName: string;
  inviteUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `You're invited to ${params.organizationName}`;
  const text = `Hi ${params.recipientName},\n\nYou've been invited to ${params.organizationName}. Open: ${params.inviteUrl}`;
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h1 style="color:#4A1942;">You're invited</h1>
      <p>Hi ${params.recipientName},</p>
      <p>You've been invited to collaborate in <strong>${params.organizationName}</strong>.</p>
      <p><a href="${params.inviteUrl}" style="background:#4A1942;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;display:inline-block;">Open invitation</a></p>
    </div>
  `;
  return { subject, html, text };
}
