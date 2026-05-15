// Supabase Edge Function: send-email
// Sends transactional emails from server-rendered templates only.
// Required secrets:
//   RESEND_API_KEY
//   EMAIL_FROM
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// Optional secrets:
//   ALLOWED_ORIGIN=https://your-app.example.com

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type EmailPurpose =
  | 'invitation'
  | 'password_reset'
  | 'rsvp_confirmation'
  | 'staff_notification';

type AppRole = 'owner' | 'admin' | 'planner' | 'couple' | 'staff' | 'guest';

interface SendEmailRequest {
  to: string;
  purpose: EmailPurpose;
  organizationId: string;
  eventId?: string;
  templateData?: Record<string, unknown>;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PURPOSE_ROLES: Record<EmailPurpose, AppRole[]> = {
  invitation: ['owner', 'admin', 'planner'],
  password_reset: ['owner', 'admin'],
  rsvp_confirmation: ['owner', 'admin', 'planner', 'staff'],
  staff_notification: ['owner', 'admin', 'planner', 'staff'],
};

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_PER_USER_ORG = 100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getString(data: Record<string, unknown> | undefined, key: string, fallback = ''): string {
  const value = data?.[key];
  return typeof value === 'string' ? value : fallback;
}

function renderShell(title: string, body: string): string {
  return `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.5; color: #1f2937; max-width: 640px; margin: 0 auto;">
      <h1 style="color:#4A1942; font-size: 24px; margin-bottom: 16px;">${escapeHtml(title)}</h1>
      ${body}
      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">This message was sent by your wedding venue planning workspace.</p>
    </div>
  `;
}

function renderEmail(purpose: EmailPurpose, templateData: Record<string, unknown> | undefined): RenderedEmail {
  const recipientName = escapeHtml(getString(templateData, 'recipientName', 'there'));
  const organizationName = escapeHtml(getString(templateData, 'organizationName', 'your venue team'));
  const eventName = escapeHtml(getString(templateData, 'eventName', 'your event'));

  switch (purpose) {
    case 'invitation': {
      const inviteUrl = escapeHtml(getString(templateData, 'inviteUrl'));
      if (!inviteUrl) throw new Error('Missing templateData.inviteUrl for invitation email.');
      const subject = `You're invited to ${organizationName}`;
      const text = `Hi ${recipientName},\n\nYou've been invited to collaborate in ${organizationName}. Open: ${inviteUrl}`;
      const html = renderShell("You're invited", `
        <p>Hi ${recipientName},</p>
        <p>You've been invited to collaborate in <strong>${organizationName}</strong>.</p>
        <p><a href="${inviteUrl}" style="background:#4A1942;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;display:inline-block;">Open invitation</a></p>
      `);
      return { subject, text, html };
    }
    case 'password_reset': {
      const resetUrl = escapeHtml(getString(templateData, 'resetUrl'));
      if (!resetUrl) throw new Error('Missing templateData.resetUrl for password reset email.');
      const subject = `Password reset for ${organizationName}`;
      const text = `Hi ${recipientName},\n\nReset your password here: ${resetUrl}`;
      const html = renderShell('Password reset', `
        <p>Hi ${recipientName},</p>
        <p>A password reset was requested for your ${organizationName} account.</p>
        <p><a href="${resetUrl}" style="background:#4A1942;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;display:inline-block;">Reset password</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      `);
      return { subject, text, html };
    }
    case 'rsvp_confirmation': {
      const status = escapeHtml(getString(templateData, 'status', 'received'));
      const subject = `RSVP confirmation for ${eventName}`;
      const text = `Hi ${recipientName},\n\nYour RSVP for ${eventName} has been ${status}.`;
      const html = renderShell('RSVP confirmation', `
        <p>Hi ${recipientName},</p>
        <p>Your RSVP for <strong>${eventName}</strong> has been <strong>${status}</strong>.</p>
      `);
      return { subject, text, html };
    }
    case 'staff_notification': {
      const taskTitle = escapeHtml(getString(templateData, 'taskTitle', 'Event update'));
      const message = escapeHtml(getString(templateData, 'message', 'Please review the latest event update.'));
      const subject = `${eventName}: ${taskTitle}`;
      const text = `${taskTitle}\n\n${message}`;
      const html = renderShell(taskTitle, `
        <p><strong>Event:</strong> ${eventName}</p>
        <p>${message}</p>
      `);
      return { subject, text, html };
    }
    default:
      throw new Error('Unsupported email purpose.');
  }
}

async function ensureRateLimit(supabase: ReturnType<typeof createClient>, organizationId: string, userId: string) {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('actor_id', userId)
    .like('action', 'email.%')
    .gte('created_at', since);

  if (error) throw error;
  if ((count ?? 0) >= RATE_LIMIT_MAX_PER_USER_ORG) {
    throw new Error('Email rate limit exceeded for this organization and user.');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const emailFrom = Deno.env.get('EMAIL_FROM');

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom) {
    return json({ error: 'Email service is not configured.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(
    authHeader.replace(/^Bearer\s+/i, ''),
  );

  if (userError || !userData.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: SendEmailRequest;
  try {
    payload = (await req.json()) as SendEmailRequest;
  } catch {
    return json({ error: 'Invalid JSON request body.' }, 400);
  }

  const to = sanitizeEmail(payload.to || '');
  if (!to || !payload.organizationId || !payload.purpose) {
    return json({ error: 'Missing required to, organizationId, or purpose.' }, 400);
  }

  if (!Object.prototype.hasOwnProperty.call(PURPOSE_ROLES, payload.purpose)) {
    return json({ error: 'Unsupported email purpose.' }, 400);
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('role,status')
    .eq('organization_id', payload.organizationId)
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .single();

  if (membershipError || !membership) {
    return json({ error: 'Forbidden' }, 403);
  }

  const allowedRoles = PURPOSE_ROLES[payload.purpose];
  if (!allowedRoles.includes(membership.role as AppRole)) {
    return json({ error: 'Insufficient role for this email purpose.' }, 403);
  }

  let rendered: RenderedEmail;
  try {
    await ensureRateLimit(supabase, payload.organizationId, userData.user.id);
    rendered = renderEmail(payload.purpose, payload.templateData);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to prepare email.' }, 400);
  }

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    }),
  });

  const resendBody = await resendResponse.json().catch(() => ({}));

  await supabase.from('audit_logs').insert({
    organization_id: payload.organizationId,
    event_id: payload.eventId ?? null,
    actor_id: userData.user.id,
    action: resendResponse.ok ? `email.${payload.purpose}.sent` : `email.${payload.purpose}.failed`,
    entity_type: 'email',
    after_data: {
      to,
      subject: rendered.subject,
      purpose: payload.purpose,
      providerStatus: resendResponse.status,
      providerResponse: resendBody,
    },
  });

  if (!resendResponse.ok) {
    return json({ error: 'Email provider rejected request.', details: resendBody }, 502);
  }

  return json({ ok: true, provider: resendBody });
});
