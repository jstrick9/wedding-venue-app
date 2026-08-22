// Supabase Edge Function: send-email
// Sends transactional emails from server-rendered templates only.
// Required secrets:
//   RESEND_API_KEY
//   EMAIL_FROM
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type EmailPurpose =
  | 'invitation'
  | 'venue_admin_invite'
  | 'guest_invite'
  | 'guest_reminder'
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

function corsHeadersFor(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const PURPOSE_ROLES: Record<Exclude<EmailPurpose, 'venue_admin_invite'>, AppRole[]> = {
  invitation: ['owner', 'admin', 'planner'],
  guest_invite: ['owner', 'admin', 'planner'],
  guest_reminder: ['owner', 'admin', 'planner'],
  password_reset: ['owner', 'admin'],
  rsvp_confirmation: ['owner', 'admin', 'planner', 'staff'],
  staff_notification: ['owner', 'admin', 'planner', 'staff'],
};

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_PER_USER_ORG = 100;

function jsonWith(corsHeaders: Record<string, string>, body: unknown, status = 200) {
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

function renderPlainTemplate(templateData: Record<string, unknown> | undefined): RenderedEmail {
  const subject = getString(templateData, 'subject').trim();
  const text = getString(templateData, 'body').trim();
  const inviteUrl = getString(templateData, 'inviteUrl').trim();
  if (!subject || !text) throw new Error('Invite email subject and body are required.');
  if (!inviteUrl) throw new Error('Missing templateData.inviteUrl for venue administrator invite.');
  const escapedBody = escapeHtml(text);
  const escapedUrl = escapeHtml(inviteUrl);
  const linked = escapedUrl ? escapedBody.split(escapedUrl).join(`<a href="${escapedUrl}">${escapedUrl}</a>`) : escapedBody;
  return {
    subject,
    text,
    html: renderShell(subject, `<div>${linked.replace(/\n/g, '<br/>')}</div>`),
  };
}

function renderEmail(purpose: EmailPurpose, templateData: Record<string, unknown> | undefined): RenderedEmail {
  const recipientName = escapeHtml(getString(templateData, 'recipientName', 'there'));
  const organizationName = escapeHtml(getString(templateData, 'organizationName', 'your venue team'));
  const eventName = escapeHtml(getString(templateData, 'eventName', 'your event'));

  switch (purpose) {
    case 'venue_admin_invite':
      return renderPlainTemplate(templateData);
    case 'invitation': {
      const inviteUrl = escapeHtml(getString(templateData, 'inviteUrl'));
      if (!inviteUrl) throw new Error('Missing templateData.inviteUrl for invitation email.');
      const subject = `You are invited to ${organizationName}`;
      const text = `Hi ${recipientName},\n\nYou have been invited to collaborate in ${organizationName}. Open: ${inviteUrl}`;
      const html = renderShell('You are invited', `
        <p>Hi ${recipientName},</p>
        <p>You have been invited to collaborate in <strong>${organizationName}</strong>.</p>
        <p><a href="${inviteUrl}" style="background:#4A1942;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;display:inline-block;">Open invitation</a></p>
      `);
      return { subject, text, html };
    }
    case 'guest_invite': {
      const inviteUrl = escapeHtml(getString(templateData, 'inviteUrl'));
      if (!inviteUrl) throw new Error('Missing templateData.inviteUrl for guest invite email.');
      const subject = `RSVP for ${eventName}`;
      const text = `Hi ${recipientName},\n\nYou have been invited to ${eventName}. Please RSVP here: ${inviteUrl}`;
      const html = renderShell('You are invited', `
        <p>Hi ${recipientName},</p>
        <p>You have been invited to <strong>${eventName}</strong>!</p>
        <p><a href="${inviteUrl}" style="background:#4A1942;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;display:inline-block;">View invitation &amp; RSVP</a></p>
      `);
      return { subject, text, html };
    }
    case 'guest_reminder': {
      const inviteUrl = escapeHtml(getString(templateData, 'inviteUrl'));
      if (!inviteUrl) throw new Error('Missing templateData.inviteUrl for guest reminder email.');
      const subject = `Friendly reminder: RSVP for ${eventName}`;
      const text = `Hi ${recipientName},\n\nWe would love to know if you can make it to ${eventName}. Please RSVP here: ${inviteUrl}`;
      const html = renderShell('RSVP reminder', `
        <p>Hi ${recipientName},</p>
        <p>We would love to know if you can make it to <strong>${eventName}</strong>!</p>
        <p><a href="${inviteUrl}" style="background:#4A1942;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;display:inline-block;">RSVP now</a></p>
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
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status = 200) => jsonWith(corsHeaders, body, status);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
  const smtpUser = Deno.env.get('SMTP_USER') || DEFAULT_SMTP_USER;
  const smtpPass = Deno.env.get('SMTP_PASS') || '';
  const smtpHost = Deno.env.get('SMTP_HOST') || DEFAULT_SMTP_HOST;
  const smtpPort = Number(Deno.env.get('SMTP_PORT') || '587');
  const emailFrom = Deno.env.get('EMAIL_FROM') || DEFAULT_FROM;
  const canResend = Boolean(resendApiKey);
  const canSmtp = Boolean(smtpUser && smtpPass);

  if (!supabaseUrl || !serviceRoleKey || (!canResend && !canSmtp)) {
    return json({ error: 'Email service is not configured. Set SMTP_PASS for Outlook (wedding-vip@outlook.com) or RESEND_API_KEY + EMAIL_FROM.' }, 500);
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

  if (payload.purpose === 'venue_admin_invite') {
    const { data: platformRole } = await supabase
      .from('platform_memberships')
      .select('role,status')
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .in('role', ['platform_owner', 'platform_admin'])
      .maybeSingle();
    if (!platformRole) return json({ error: 'Platform administrator access required to send venue invites.' }, 403);
  } else {
    const allowedRoles = PURPOSE_ROLES[payload.purpose as Exclude<EmailPurpose, 'venue_admin_invite'>];
    if (!allowedRoles) return json({ error: 'Unsupported email purpose.' }, 400);
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('role,status')
      .eq('organization_id', payload.organizationId)
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError || !membership) return json({ error: 'Forbidden' }, 403);
    if (!allowedRoles.includes(membership.role as AppRole)) {
      return json({ error: 'Insufficient role for this email purpose.' }, 403);
    }
  }

  let rendered: RenderedEmail;
  try {
    await ensureRateLimit(supabase, payload.organizationId, userData.user.id);
    rendered = renderEmail(payload.purpose, payload.templateData);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to prepare email.' }, 400);
  }

  const delivery = await deliverRenderedEmail({
    canResend,
    resendApiKey,
    canSmtp,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    emailFrom,
    to,
    rendered,
  });

  await supabase.from('audit_logs').insert({
    organization_id: payload.organizationId,
    event_id: payload.eventId ?? null,
    actor_id: userData.user.id,
    action: delivery.ok ? `email.${payload.purpose}.sent` : `email.${payload.purpose}.failed`,
    entity_type: 'email',
    after_data: {
      to,
      subject: rendered.subject,
      purpose: payload.purpose,
      provider: delivery.provider,
      providerStatus: delivery.status,
      providerResponse: delivery.details,
    },
  });

  if (!delivery.ok) {
    return json({ error: 'Email provider rejected request.', details: delivery.details }, 502);
  }

  return json({ ok: true, provider: delivery.provider, details: delivery.details });
});

async function sendViaResend(resendApiKey: string, emailFrom: string, to: string, rendered: RenderedEmail) {
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
  return { ok: resendResponse.ok, status: resendResponse.status, details: resendBody };
}

async function sendViaOutlookSmtp(opts: {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  to: string;
  rendered: RenderedEmail;
}) {
  const implicitTls = opts.smtpPort === 465;
  const client = new SMTPClient({
    connection: {
      hostname: opts.smtpHost,
      port: opts.smtpPort,
      tls: implicitTls,
      auth: {
        username: opts.smtpUser,
        password: opts.smtpPass,
      },
    },
  });
  try {
    await client.send({
      from: opts.emailFrom,
      to: opts.to,
      subject: opts.rendered.subject,
      content: opts.rendered.text,
      html: opts.rendered.html,
    });
    return { ok: true as const, status: 250, details: { provider: 'outlook-smtp', host: opts.smtpHost } };
  } finally {
    try {
      await client.close();
    } catch {
      // ignore close errors after a send failure
    }
  }
}

async function deliverRenderedEmail(opts: {
  canResend: boolean;
  resendApiKey: string;
  canSmtp: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  to: string;
  rendered: RenderedEmail;
}): Promise<{ ok: boolean; provider: string; status: number; details: unknown }> {
  let last: { ok: boolean; provider: string; status: number; details: unknown } = {
    ok: false,
    provider: 'none',
    status: 500,
    details: { error: 'No email provider configured.' },
  };

  if (opts.canResend) {
    try {
      const resend = await sendViaResend(opts.resendApiKey, opts.emailFrom, opts.to, opts.rendered);
      last = { ok: resend.ok, provider: 'resend', status: resend.status, details: resend.details };
      if (resend.ok) return last;
    } catch (error) {
      last = { ok: false, provider: 'resend', status: 502, details: { error: error instanceof Error ? error.message : 'Resend failed' } };
    }
  }

  if (opts.canSmtp) {
    try {
      const smtp = await sendViaOutlookSmtp({
        smtpHost: opts.smtpHost,
        smtpPort: opts.smtpPort,
        smtpUser: opts.smtpUser,
        smtpPass: opts.smtpPass,
        emailFrom: opts.emailFrom,
        to: opts.to,
        rendered: opts.rendered,
      });
      return { ok: smtp.ok, provider: 'outlook-smtp', status: smtp.status, details: smtp.details };
    } catch (error) {
      last = { ok: false, provider: 'outlook-smtp', status: 502, details: { error: error instanceof Error ? error.message : 'Outlook SMTP failed' } };
    }
  }

  return last;
}
