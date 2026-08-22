// Supabase Edge Function: send-email
// Sends transactional emails from server-rendered templates only.
// Required secrets:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// Optional:
//   GRAPH_CLIENT_ID / GRAPH_REFRESH_TOKEN   fallback if migration 0015 is not applied
//   RESEND_API_KEY
//   SMTP_FORCE=1                            last-resort SMTPS 465 (usually blocked)
//
// Supabase Edge cannot open Outlook SMTP (25/587 blocked, 465 times out).
// Unattended send uses Microsoft Graph HTTPS after Connect Outlook.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const DEFAULT_SMTP_USER = 'wedding-vip@outlook.com';
const DEFAULT_SMTP_HOST = 'smtp-mail.outlook.com';
const DEFAULT_FROM = 'Wedding VIP <wedding-vip@outlook.com>';
const SETUP_ACCOUNT_BUTTON_LABEL = 'Set up your account';
const SMTP_CONNECT_TIMEOUT_MS = 8000;
const SMTP_COMMAND_TIMEOUT_MS = 8000;
const SMTP_OVERALL_TIMEOUT_MS = 18000;

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
  action?: 'outlook_exchange' | 'outlook_status' | 'outlook_disconnect';
  to?: string;
  purpose?: EmailPurpose;
  organizationId?: string;
  eventId?: string;
  templateData?: Record<string, unknown>;
  clientId?: string;
  code?: string;
  verifier?: string;
  redirectUri?: string;
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

function extractEmailAddress(value: string): string {
  const angled = value.match(/<([^>]+)>/);
  return sanitizeEmail(angled?.[1] || value);
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

function renderSetupAccountButton(inviteUrl: string): string {
  return `<p style="margin:24px 0 8px;"><a href="${escapeHtml(inviteUrl)}" style="background:#4A1942;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:700;">${SETUP_ACCOUNT_BUTTON_LABEL}</a></p>`;
}

function joinContactName(firstName: string, lastName: string): string {
  return [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(' ');
}

function applyContactGreeting(body: string, firstName: string, lastName: string): string {
  const name = joinContactName(firstName, lastName);
  const greeting = name ? `Hello ${name},` : 'Hello,';
  if (/^Hello\b[^\n]*,/m.test(body)) return body.replace(/^Hello\b[^\n]*,/m, greeting);
  return `${greeting}\n\n${body.replace(/^\s+/, '')}`;
}

function injectSetupButton(htmlBody: string, inviteUrl: string): string {
  const button = renderSetupAccountButton(inviteUrl);
  const escapedUrl = escapeHtml(inviteUrl);
  const next = htmlBody.replace(/Open this one-time setup link to create your password and claim the venue:<br\s*\/?>/gi, '');
  if (escapedUrl && next.includes(escapedUrl)) {
    return next.split(escapedUrl).join(button);
  }
  const marker = 'claim the venue.';
  const idx = next.toLowerCase().indexOf(marker);
  if (idx >= 0) {
    const end = idx + marker.length;
    return `${next.slice(0, end)}${button}${next.slice(end)}`;
  }
  return `${next}${button}`;
}

function renderVenueAdminInvite(templateData: Record<string, unknown> | undefined): RenderedEmail {
  const subject = getString(templateData, 'subject').trim();
  const rawBody = getString(templateData, 'body').trim();
  const inviteUrl = getString(templateData, 'inviteUrl').trim();
  if (!subject || !rawBody) throw new Error('Invite email subject and body are required.');
  if (!inviteUrl) throw new Error('Missing templateData.inviteUrl for venue administrator invite.');
  const firstName = getString(templateData, 'contactFirstName');
  const lastName = getString(templateData, 'contactLastName');
  const text = applyContactGreeting(rawBody, firstName, lastName);
  const textWithLink = text.includes(inviteUrl) ? text : `${text}\n\n${SETUP_ACCOUNT_BUTTON_LABEL}:\n${inviteUrl}`;
  const htmlBody = injectSetupButton(escapeHtml(text).replace(/\n/g, '<br/>'), inviteUrl);
  return {
    subject,
    text: textWithLink,
    html: renderShell(subject, `<div>${htmlBody}</div>`),
  };
}

function renderEmail(purpose: EmailPurpose, templateData: Record<string, unknown> | undefined): RenderedEmail {
  const recipientName = escapeHtml(getString(templateData, 'recipientName', 'there'));
  const organizationName = escapeHtml(getString(templateData, 'organizationName', 'your venue team'));
  const eventName = escapeHtml(getString(templateData, 'eventName', 'your event'));

  switch (purpose) {
    case 'venue_admin_invite':
      return renderVenueAdminInvite(templateData);
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

function resolveSmtpPort(raw: string): number {
  const parsed = Number(raw || '465');
  if (!Number.isFinite(parsed) || parsed === 25 || parsed === 587) return 465;
  return parsed;
}

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status = 200) => jsonWith(corsHeaders, body, status);

  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
    const smtpUser = Deno.env.get('SMTP_USER') || DEFAULT_SMTP_USER;
    const smtpPass = Deno.env.get('SMTP_PASS') || '';
    const smtpHost = Deno.env.get('SMTP_HOST') || DEFAULT_SMTP_HOST;
    const smtpPort = resolveSmtpPort(Deno.env.get('SMTP_PORT') || '465');
    const emailFrom = Deno.env.get('EMAIL_FROM') || DEFAULT_FROM;
    const forceSmtp = Deno.env.get('SMTP_FORCE') === '1';
    const canResend = Boolean(resendApiKey);
    const canSmtp = forceSmtp && Boolean(smtpUser && smtpPass);

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Email service is not configured.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(
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

    if (payload.action === 'outlook_exchange' || payload.action === 'outlook_status' || payload.action === 'outlook_disconnect') {
      const { data: platformRole } = await admin
        .from('platform_memberships')
        .select('role,status')
        .eq('user_id', userData.user.id)
        .eq('status', 'active')
        .in('role', ['platform_owner', 'platform_admin'])
        .maybeSingle();
      if (!platformRole) return json({ error: 'Platform administrator access required.' }, 403);
      if (payload.action === 'outlook_status') {
        const status = await loadOutlookStatus(admin);
        return json({ ok: true, ...status });
      }
      if (payload.action === 'outlook_disconnect') {
        const { error } = await admin.from('platform_mail_secrets').update({
          refresh_token: null,
          connected_email: null,
          updated_at: new Date().toISOString(),
          updated_by: userData.user.id,
        }).eq('id', 'default');
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      try {
        const connected = await exchangeOutlookCode(admin, userData.user.id, payload);
        return json({ ok: true, email: connected.email });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Could not connect Outlook.' }, 400);
      }
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
      await ensureRateLimit(admin, payload.organizationId, userData.user.id);
      rendered = renderEmail(payload.purpose, payload.templateData);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Unable to prepare email.' }, 400);
    }

    const delivery = await deliverRenderedEmail({
      admin,
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

    const { error: auditError } = await admin.from('audit_logs').insert({
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
    if (auditError) console.error('send-email audit_logs insert failed', auditError.message);

    if (!delivery.ok) {
      const detailError = delivery.details && typeof delivery.details === 'object' && delivery.details !== null && 'error' in delivery.details
        ? String((delivery.details as { error?: unknown }).error || '').trim()
        : '';
      return json({ error: detailError || 'Email provider rejected request.', details: delivery.details }, 502);
    }

    return json({ ok: true, provider: delivery.provider, details: delivery.details });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'send-email failed.' }, 500);
  }
});


const GRAPH_TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const GRAPH_SCOPES = 'offline_access Mail.Send User.Read';

async function loadOutlookSecrets(admin: ReturnType<typeof createClient>): Promise<{ clientId: string; refreshToken: string; connectedEmail: string }> {
  const envClient = Deno.env.get('GRAPH_CLIENT_ID') || '';
  const envToken = Deno.env.get('GRAPH_REFRESH_TOKEN') || '';
  const { data } = await admin.from('platform_mail_secrets').select('client_id, refresh_token, connected_email').eq('id', 'default').maybeSingle();
  return {
    clientId: String(data?.client_id || envClient || '').trim(),
    refreshToken: String(data?.refresh_token || envToken || '').trim(),
    connectedEmail: String(data?.connected_email || '').trim(),
  };
}

async function loadOutlookStatus(admin: ReturnType<typeof createClient>) {
  const secrets = await loadOutlookSecrets(admin);
  return { connected: Boolean(secrets.refreshToken), email: secrets.connectedEmail || null, clientId: secrets.clientId || null };
}

async function persistOutlookSecrets(admin: ReturnType<typeof createClient>, userId: string, secrets: { clientId: string; refreshToken: string; connectedEmail: string }) {
  const { error } = await admin.from('platform_mail_secrets').upsert({
    id: 'default',
    provider: 'microsoft_graph',
    client_id: secrets.clientId,
    refresh_token: secrets.refreshToken,
    connected_email: secrets.connectedEmail,
    updated_at: new Date().toISOString(),
    updated_by: userId || null,
  });
  if (error) throw new Error(error.message);
}

async function exchangeOutlookCode(
  admin: ReturnType<typeof createClient>,
  userId: string,
  payload: SendEmailRequest,
): Promise<{ email: string }> {
  const clientId = String(payload.clientId || '').trim();
  const code = String(payload.code || '').trim();
  const verifier = String(payload.verifier || '').trim();
  const redirectUri = String(payload.redirectUri || '').trim();
  if (!clientId || !code || !verifier || !redirectUri) throw new Error('Missing Outlook OAuth client ID, code, verifier, or redirect URI.');
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    scope: GRAPH_SCOPES,
  });
  const tokenResponse = await fetch(GRAPH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (!tokenResponse.ok || !tokenPayload.refresh_token || !tokenPayload.access_token) {
    throw new Error(String(tokenPayload.error_description || tokenPayload.error || 'Microsoft did not return Outlook tokens.'));
  }
  const meResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${String(tokenPayload.access_token)}` },
  });
  const me = await meResponse.json().catch(() => ({})) as Record<string, unknown>;
  const email = String(me.mail || me.userPrincipalName || '').trim();
  await persistOutlookSecrets(admin, userId, {
    clientId,
    refreshToken: String(tokenPayload.refresh_token),
    connectedEmail: email,
  });
  return { email };
}

async function sendViaMicrosoftGraph(
  admin: ReturnType<typeof createClient>,
  to: string,
  rendered: RenderedEmail,
): Promise<{ ok: boolean; status: number; details: unknown }> {
  const secrets = await loadOutlookSecrets(admin);
  if (!secrets.clientId || !secrets.refreshToken) {
    return {
      ok: false,
      status: 409,
      details: { error: 'Outlook is not connected. Open Platform Console → Email and connect wedding-vip@outlook.com. Supabase Edge cannot use Outlook SMTP ports.' },
    };
  }
  const tokenResponse = await fetch(GRAPH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: secrets.clientId,
      grant_type: 'refresh_token',
      refresh_token: secrets.refreshToken,
      scope: GRAPH_SCOPES,
    }),
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    return {
      ok: false,
      status: tokenResponse.status || 401,
      details: { error: String(tokenPayload.error_description || tokenPayload.error || 'Outlook connection expired. Reconnect Outlook in Platform Console → Email.') },
    };
  }
  if (typeof tokenPayload.refresh_token === 'string' && tokenPayload.refresh_token.trim()) {
    await persistOutlookSecrets(admin, '', {
      clientId: secrets.clientId,
      refreshToken: tokenPayload.refresh_token.trim(),
      connectedEmail: secrets.connectedEmail,
    }).catch((error) => console.error('send-email could not rotate Outlook refresh token', error));
  }
  const sendResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${String(tokenPayload.access_token)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: rendered.subject,
        body: { contentType: 'HTML', content: rendered.html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });
  if (sendResponse.status === 202 || sendResponse.ok) {
    return { ok: true, status: sendResponse.status, details: { provider: 'microsoft-graph' } };
  }
  const sendBody = await sendResponse.json().catch(() => ({})) as Record<string, unknown>;
  const graphError = sendBody.error && typeof sendBody.error === 'object' ? sendBody.error as Record<string, unknown> : sendBody;
  return {
    ok: false,
    status: sendResponse.status,
    details: { error: String(graphError.message || graphError.error || 'Microsoft Graph rejected the sendMail request.') },
  };
}

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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function toBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

function buildRfc822(opts: { from: string; to: string; subject: string; text: string; html: string }): string {
  const boundary = `wvip-${crypto.randomUUID()}`;
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    opts.text.replace(/\r?\n/g, '\r\n'),
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    opts.html.replace(/\r?\n/g, '\r\n'),
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return `${headers.join('\r\n')}\r\n\r\n${body}`;
}

function dotStuff(message: string): string {
  return message
    .replace(/\r?\n/g, '\r\n')
    .split('\r\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');
}

class SmtpClient {
  private leftover = '';
  constructor(private conn: Deno.Conn) {}

  static async connect(hostname: string, port: number): Promise<SmtpClient> {
    const conn = await withTimeout(
      Deno.connectTls({ hostname, port }),
      SMTP_CONNECT_TIMEOUT_MS,
      `TLS connect ${hostname}:${port}`,
    );
    const client = new SmtpClient(conn);
    const greeting = await client.readResponse();
    if (greeting.code !== 220) throw new Error(`SMTP greeting failed (${greeting.code}): ${greeting.text}`);
    return client;
  }

  async writeLine(line: string): Promise<void> {
    const payload = new TextEncoder().encode(`${line}\r\n`);
    let offset = 0;
    while (offset < payload.length) {
      const written = await this.conn.write(payload.subarray(offset));
      offset += written;
    }
  }

  async readResponse(): Promise<{ code: number; text: string }> {
    const decoder = new TextDecoder();
    const lines: string[] = [];
    while (true) {
      if (!this.leftover.includes('\n')) {
        const chunk = new Uint8Array(1024);
        const n = await withTimeout(this.conn.read(chunk), SMTP_COMMAND_TIMEOUT_MS, 'SMTP read');
        if (n === null) throw new Error('SMTP connection closed');
        this.leftover += decoder.decode(chunk.subarray(0, n));
        continue;
      }
      const newline = this.leftover.indexOf('\n');
      const raw = this.leftover.slice(0, newline).replace(/\r$/, '');
      this.leftover = this.leftover.slice(newline + 1);
      if (!raw) continue;
      lines.push(raw);
      if (/^\d{3} /.test(raw)) {
        return { code: Number(raw.slice(0, 3)), text: lines.join('\n') };
      }
    }
  }

  async command(line: string, expected: number | number[]): Promise<{ code: number; text: string }> {
    await this.writeLine(line);
    const response = await this.readResponse();
    const allowed = Array.isArray(expected) ? expected : [expected];
    if (!allowed.includes(response.code)) {
      throw new Error(`SMTP ${line.split(' ')[0]} failed (${response.code}): ${response.text}`);
    }
    return response;
  }

  async close(): Promise<void> {
    try {
      await this.writeLine('QUIT');
    } catch {
      // ignore
    }
    try {
      this.conn.close();
    } catch {
      // ignore
    }
  }
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
  const send = async () => {
    console.log('send-email: Outlook SMTPS', { host: opts.smtpHost, port: opts.smtpPort, user: opts.smtpUser });
    const client = await SmtpClient.connect(opts.smtpHost, opts.smtpPort);
    try {
      await client.command(`EHLO weddingvip`, 250);
      await client.command('AUTH LOGIN', 334);
      await client.command(toBase64(opts.smtpUser), 334);
      await client.command(toBase64(opts.smtpPass), 235);
      await client.command(`MAIL FROM:<${extractEmailAddress(opts.emailFrom)}>`, 250);
      await client.command(`RCPT TO:<${opts.to}>`, [250, 251]);
      await client.command('DATA', 354);
      const rfc822 = dotStuff(buildRfc822({
        from: opts.emailFrom,
        to: opts.to,
        subject: opts.rendered.subject,
        text: opts.rendered.text,
        html: opts.rendered.html,
      }));
      await client.writeLine(`${rfc822}\r\n.`);
      const dataResult = await client.readResponse();
      if (dataResult.code !== 250) throw new Error(`SMTP DATA failed (${dataResult.code}): ${dataResult.text}`);
      return {
        ok: true as const,
        status: 250,
        details: { provider: 'outlook-smtp', host: opts.smtpHost, port: opts.smtpPort },
      };
    } finally {
      await client.close();
    }
  };

  return withTimeout(send(), SMTP_OVERALL_TIMEOUT_MS, `Outlook SMTPS ${opts.smtpHost}:${opts.smtpPort}`);
}

async function deliverRenderedEmail(opts: {
  admin: ReturnType<typeof createClient>;
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
    details: { error: 'Outlook is not connected. Open Platform Console → Email and connect wedding-vip@outlook.com. Supabase Edge cannot use Outlook SMTP ports.' },
  };

  try {
    const graph = await sendViaMicrosoftGraph(opts.admin, opts.to, opts.rendered);
    if (graph.ok) return { ok: true, provider: 'microsoft-graph', status: graph.status, details: graph.details };
    last = { ok: false, provider: 'microsoft-graph', status: graph.status, details: graph.details };
  } catch (error) {
    last = { ok: false, provider: 'microsoft-graph', status: 502, details: { error: error instanceof Error ? error.message : 'Microsoft Graph failed' } };
  }

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
      last = {
        ok: false,
        provider: 'outlook-smtp',
        status: 502,
        details: { error: error instanceof Error ? error.message : 'Outlook SMTP failed' },
      };
    }
  }

  return last;
}
