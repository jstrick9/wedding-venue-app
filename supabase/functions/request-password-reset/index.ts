// Public password-recovery request endpoint.
//
// The caller has no session yet. Account eligibility is derived server-side,
// responses do not reveal whether an account exists, and migration 0022 applies
// service-only rate limits before any account lookup or email delivery.
//
// Required runtime secrets (project defaults are supplied automatically):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   BREVO_API_KEY or RESEND_API_KEY
// Public production deployment defaults are versioned below (one origin and
// sender for the entire SaaS, never one value per tenant). Optional runtime
// overrides for another environment:
//   PUBLIC_APP_URL
//   PASSWORD_RESET_FROM_EMAIL
// Legacy URL compatibility:
//   PASSWORD_RESET_APP_URL

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const DEFAULT_FROM_NAME = 'Wedding VIP';
const DEPLOYMENT_PUBLIC_APP_URL = 'https://weddingvip.vercel.app';
const DEPLOYMENT_PASSWORD_RESET_FROM_EMAIL = 'wedding-vip@outlook.com';
const MIN_RESPONSE_MS = 900;
const DELIVERY_TIMEOUT_MS = 6000;

type PasswordResetSurface = 'platform' | 'venue';

interface PasswordResetRequestBody {
  email?: unknown;
  surface?: unknown;
  organizationId?: unknown;
  redirectTo?: unknown;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface DeliveryResult {
  ok: boolean;
  channel: 'brevo' | 'resend' | 'none';
  status: number;
}

function configuredApplicationUrl(): string {
  // One deployment has one trusted application origin. Tenant identity and
  // branding are resolved from membership data, never from separate URLs or
  // browser-provided branding. Keep the #274 name as a rollout-compatible
  // fallback while PUBLIC_APP_URL remains the project-wide source of truth.
  return (
    Deno.env.get('PUBLIC_APP_URL')
    || Deno.env.get('PASSWORD_RESET_APP_URL')
    || DEPLOYMENT_PUBLIC_APP_URL
  ).trim();
}

function requestOriginAllowed(request: Request, configuredAppUrl: string): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  const requestedOrigin = safeWebUrl(origin);
  if (!requestedOrigin || requestedOrigin.origin !== origin.replace(/\/$/, '')) return false;
  const configured = safeWebUrl(configuredAppUrl);
  if (configured) return requestedOrigin.origin === configured.origin;
  return ['localhost', '127.0.0.1', '[::1]'].includes(requestedOrigin.hostname);
}

function corsHeadersFor(request: Request, originAllowed: boolean): Record<string, string> {
  const origin = request.headers.get('Origin');
  return {
    ...(originAllowed ? { 'Access-Control-Allow-Origin': origin || '*' } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function jsonWith(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function readBoundedJson(request: Request, maxBytes = 4096): Promise<Record<string, unknown> | null> {
  if (!request.body) return null;
  const declared = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return asRecord(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isPlausibleEmail(email: string): boolean {
  return email.length >= 3
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseOrganizationId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)
    ? id
    : null;
}

function safeWebUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const target = new URL(value);
    const localHttp = target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
    if (target.protocol !== 'https:' && !localHttp) return null;
    if (target.username || target.password) return null;
    return target;
  } catch {
    return null;
  }
}

function parseRedirectTarget(value: unknown, surface: PasswordResetSurface): string | null {
  const target = safeWebUrl(value);
  if (!target || target.pathname.replace(/\/+$/, '') !== `/reset/${surface}`) return null;
  target.search = '';
  target.hash = '';
  return target.toString();
}

function configuredAppRedirect(value: unknown, surface: PasswordResetSurface): string | null {
  const target = safeWebUrl(value);
  if (!target) return null;
  target.pathname = `/reset/${surface}`;
  target.search = '';
  target.hash = '';
  return target.toString();
}

function isLocalDevelopmentRedirect(value: string): boolean {
  try {
    const target = new URL(value);
    return ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  } catch {
    return false;
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeDisplayName(value: unknown): string {
  const displayName = typeof value === 'string' ? value.replace(/[\r\n]+/g, ' ').trim() : '';
  return displayName.slice(0, 120) || DEFAULT_FROM_NAME;
}

function renderPasswordResetEmail(params: {
  displayName: string;
  recipientName: string;
  resetUrl: string;
}): RenderedEmail {
  const displayName = safeDisplayName(params.displayName);
  const recipientName = params.recipientName.trim().slice(0, 200);
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  const subject = `${displayName}: reset your password`;
  const text = [
    greeting,
    '',
    `We received a request to reset the password for your ${displayName} account.`,
    '',
    `Reset password: ${params.resetUrl}`,
    '',
    'For your security, use the newest reset email. If you did not request this change, you can ignore this message.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:640px;margin:0 auto;padding:20px;">
      <h1 style="font-size:24px;margin:0 0 18px;color:#111827;">Reset your password</h1>
      <p>${escapeHtml(greeting)}</p>
      <p>We received a request to reset the password for your <strong>${escapeHtml(displayName)}</strong> account.</p>
      <p style="margin:24px 0;"><a href="${escapeHtml(params.resetUrl)}" style="background:#111827;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:700;">Reset password</a></p>
      <p style="font-size:13px;color:#4b5563;">For your security, use the newest reset email. If you did not request this change, you can ignore this message.</p>
    </div>
  `;
  return { subject, html, text };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requesterAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded
    || request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

function buildResetUrl(params: {
  validatedRedirectTo: string;
  surface: PasswordResetSurface;
  tokenHash: string;
  venueSlug?: string;
}): string {
  const target = new URL(params.validatedRedirectTo);
  target.pathname = `/reset/${params.surface}`;
  target.search = '';
  target.hash = '';
  const proof = new URLSearchParams();
  proof.set('token_hash', params.tokenHash);
  proof.set('type', 'recovery');
  if (params.surface === 'venue' && params.venueSlug) {
    proof.set('venue', params.venueSlug);
  }
  // Fragments are available to the browser but are never sent in the hosting
  // request, keeping the one-time proof out of CDN and application access logs.
  target.hash = proof.toString();
  return target.toString();
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaBrevo(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  to: string,
  rendered: RenderedEmail,
): Promise<DeliveryResult> {
  try {
    const response = await fetchWithTimeout('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject: rendered.subject,
        htmlContent: rendered.html,
        textContent: rendered.text,
      }),
    });
    await response.body?.cancel().catch(() => undefined);
    return { ok: response.ok, channel: 'brevo', status: response.status };
  } catch {
    return { ok: false, channel: 'brevo', status: 0 };
  }
}

async function sendViaResend(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  to: string,
  rendered: RenderedEmail,
): Promise<DeliveryResult> {
  try {
    const response = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    });
    await response.body?.cancel().catch(() => undefined);
    return { ok: response.ok, channel: 'resend', status: response.status };
  } catch {
    return { ok: false, channel: 'resend', status: 0 };
  }
}

serve(async (request) => {
  const startedAt = Date.now();
  let acceptedRequest = false;
  const configuredAppUrl = configuredApplicationUrl();
  const originAllowed = requestOriginAllowed(request, configuredAppUrl);
  const corsHeaders = corsHeadersFor(request, originAllowed);
  const json = (body: unknown, status = 200) => jsonWith(corsHeaders, body, status);
  const finish = async (body: unknown, status: number) => {
    const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    return json(body, status);
  };

  try {
    if (request.method === 'OPTIONS') {
      return originAllowed
        ? new Response(null, { status: 204, headers: corsHeaders })
        : new Response(null, { status: 403, headers: corsHeaders });
    }
    if (!originAllowed) return json({ error: 'Invalid request.' }, 403);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const brevoApiKey = Deno.env.get('BREVO_API_KEY') || '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
    const fromEmail = normalizeEmail(
      Deno.env.get('PASSWORD_RESET_FROM_EMAIL') || DEPLOYMENT_PASSWORD_RESET_FROM_EMAIL,
    );
    if (!supabaseUrl || !serviceRoleKey || !isPlausibleEmail(fromEmail) || (!brevoApiKey && !resendApiKey)) {
      return finish({ error: 'Password reset is temporarily unavailable. Please try again later.' }, 503);
    }

    const payload = await readBoundedJson(request) as PasswordResetRequestBody | null;
    if (!payload) return json({ error: 'Invalid request.' }, 400);

    const email = normalizeEmail(payload.email);
    const surface: PasswordResetSurface | null = payload.surface === 'platform'
      ? 'platform'
      : payload.surface === 'venue'
        ? 'venue'
        : null;
    if (!surface || !isPlausibleEmail(email)) return json({ error: 'Invalid request.' }, 400);

    const organizationId = surface === 'venue' ? parseOrganizationId(payload.organizationId) : null;
    if (surface === 'venue' && !organizationId) return json({ error: 'Invalid request.' }, 400);
    const configuredRedirectTo = configuredAppUrl
      ? configuredAppRedirect(configuredAppUrl, surface)
      : null;
    if (configuredAppUrl && !configuredRedirectTo) {
      return finish({ error: 'Password reset is temporarily unavailable. Please try again later.' }, 503);
    }
    const clientRedirectTo = parseRedirectTarget(payload.redirectTo, surface);
    const requestedRedirectTo = configuredRedirectTo || clientRedirectTo;
    if (!requestedRedirectTo) return json({ error: 'Invalid request.' }, 400);
    if (!configuredRedirectTo && !isLocalDevelopmentRedirect(requestedRedirectTo)) {
      // Never route a production recovery proof according to a browser-supplied
      // origin, even if a broader authentication allowlist would accept it.
      return finish({ error: 'Password reset is temporarily unavailable. Please try again later.' }, 503);
    }
    acceptedRequest = true;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const [emailHash, requesterHash] = await Promise.all([
      sha256Hex(`${serviceRoleKey}:email:${email}`),
      sha256Hex(`${serviceRoleKey}:requester:${requesterAddress(request)}`),
    ]);

    const { data: gateRaw, error: gateError } = await admin.rpc('begin_password_reset_request', {
      p_email_hash: emailHash,
      p_requester_hash: requesterHash,
      p_surface: surface,
      p_organization_id: organizationId,
    });
    const gate = asRecord(gateRaw);
    if (gateError || !gate || gate.ok !== true) {
      console.error('password reset throttle unavailable', gateError?.message || gateRaw);
      return finish({ ok: true }, 202);
    }
    if (gate.allowed !== true) return finish({ ok: true }, 202);

    const requestId = typeof gate.request_id === 'string' ? gate.request_id : '';
    if (!requestId) {
      console.error('password reset throttle returned no audit id');
      return finish({ ok: true }, 202);
    }
    const processAcceptedRequest = async () => {
      const mark = async (deliveryState: 'skipped' | 'sent' | 'failed', failureCode?: string) => {
        if (!requestId) return;
        try {
          const { error } = await admin
            .from('password_reset_requests')
            .update({
              delivery_state: deliveryState,
              failure_code: failureCode || null,
              completed_at: new Date().toISOString(),
            })
            .eq('id', requestId);
          if (error) console.error('password reset audit update failed', error.message);
        } catch (error) {
          console.error('password reset audit update failed', error instanceof Error ? error.message : error);
        }
      };

      try {
        const { data: contextRaw, error: contextError } = await admin.rpc('get_password_reset_account_context', {
          p_email: email,
          p_surface: surface,
          p_organization_id: organizationId,
        });
        const context = asRecord(contextRaw);
        if (contextError || !context || context.ok !== true) {
          await mark('failed', 'account_lookup_failed');
          console.error('password reset account lookup failed', contextError?.message || 'invalid response');
          return;
        }
        if (context.eligible !== true) {
          await mark('skipped');
          return;
        }

        const canonicalEmail = normalizeEmail(context.email);
        const expectedUserId = typeof context.user_id === 'string' ? context.user_id : '';
        if (!canonicalEmail || !expectedUserId) {
          await mark('failed', 'invalid_account_context');
          return;
        }

        // The provider action URL is never delivered. Avoid coupling branded
        // recovery to a separate redirect allowlist: this endpoint already
        // accepts only the server-owned production URL or a loopback dev URL,
        // and places the proof in that app-owned URL's fragment below.
        const generated = await admin.auth.admin.generateLink({
          type: 'recovery',
          email: canonicalEmail,
        });
        const properties = generated.data?.properties;
        const tokenHash = properties?.hashed_token || '';
        const validatedRedirectTo = requestedRedirectTo;
        if (generated.error || !tokenHash || generated.data?.user?.id !== expectedUserId) {
          await mark('failed', 'link_generation_failed');
          console.error('password reset link generation failed', generated.error?.message || 'invalid link response');
          return;
        }

        let resetUrl: string;
        try {
          resetUrl = buildResetUrl({
            validatedRedirectTo,
            surface,
            tokenHash,
            venueSlug: surface === 'venue' && typeof context.organization_slug === 'string'
              ? context.organization_slug
              : undefined,
          });
        } catch {
          await mark('failed', 'invalid_redirect');
          return;
        }

        const displayName = safeDisplayName(context.display_name);
        const rendered = renderPasswordResetEmail({
          displayName,
          recipientName: typeof context.full_name === 'string' ? context.full_name : '',
          resetUrl,
        });
        const fromName = displayName;

        let delivery: DeliveryResult = { ok: false, channel: 'none', status: 500 };
        if (brevoApiKey) {
          delivery = await sendViaBrevo(brevoApiKey, fromEmail, fromName, canonicalEmail, rendered);
        }
        if (!delivery.ok && resendApiKey) {
          delivery = await sendViaResend(resendApiKey, fromEmail, fromName, canonicalEmail, rendered);
        }
        if (!delivery.ok) {
          await mark('failed', delivery.status === 0 ? 'delivery_timeout' : 'delivery_rejected');
          console.error('password reset delivery rejected', {
            channel: delivery.channel,
            status: delivery.status,
          });
          return;
        }

        await mark('sent');
      } catch (error) {
        await mark('failed', 'unexpected_error');
        console.error('password reset background task failed', error instanceof Error ? error.message : error);
      }
    };

    const backgroundTask = processAcceptedRequest();
    const edgeRuntime = (globalThis as typeof globalThis & {
      EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
    }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(backgroundTask);
    } else {
      // Local/test runtimes may not expose EdgeRuntime. Awaiting keeps behavior
      // deterministic there; deployed requests always use the background path.
      await backgroundTask;
    }
    return finish({ ok: true }, 202);
  } catch (error) {
    console.error('password reset request failed', error instanceof Error ? error.message : error);
    // Once a request has passed public validation, its response cannot vary with
    // account-specific processing. Operators retain the failure in logs/audit.
    return acceptedRequest
      ? finish({ ok: true }, 202)
      : finish({ error: 'Password reset is temporarily unavailable. Please try again later.' }, 503);
  }
});
