// Supabase Edge Function: claim-venue-admin
// Sets a new password for the invited venue administrator using the invite token.
// Creates the Auth user when this is the first claim. Updates the existing Auth
// user when the platform reissues an invite. Never deletes an organization or
// venue artifacts (events, layouts, guests, memberships, org_data).
//
// Auth is the invite token, not a platform or venue JWT.
// Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (provided by the runtime).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { invitePasswordPolicyError } from '../_shared/passwordPolicy.ts';

function corsHeadersFor(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function jsonWith(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

/** Best-effort failure counter for the claim throttle (migration 0017). */
async function registerClaimFailure(admin: SupabaseClient, token: string): Promise<void> {
  try {
    await admin.rpc('register_venue_admin_claim_failure', { p_token: token });
  } catch {
    // register_venue_admin_claim_failure is not deployed yet — skip.
  }
}

/**
 * Atomic claim (Review #247, requires migration 0017): consume the invite and
 * transfer ownership in one transaction right after the password is set.
 * Returns ok when the claim succeeded, `unavailable` when the RPC is missing
 * (the client-side accept_venue_admin_invite fallback still completes the
 * claim), and `error` when the claim was explicitly rejected.
 */
async function claimAtomically(
  admin: SupabaseClient,
  token: string,
  userId: string,
  email: string,
): Promise<{ ok: boolean; unavailable?: boolean; error?: string }> {
  try {
    const { data, error } = await admin.rpc('claim_venue_admin_account', {
      p_token: token,
      p_user_id: userId,
      p_email: email,
    });
    if (error) return { ok: false, unavailable: true };
    const claim = asRecord(data);
    if (!claim || claim.ok !== true) {
      return { ok: false, error: String(claim?.error || 'claim_failed') };
    }
    return { ok: true };
  } catch {
    // claim_venue_admin_account is not deployed yet — fall back to the
    // client-side accept flow.
    return { ok: false, unavailable: true };
  }
}

function alreadyRegistered(message: string): boolean {
  return /already registered|already been registered|user already exists|email_exists|already exists/i.test(message);
}

async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
): Promise<string | null> {
  const adminAny = admin.auth.admin as unknown as {
    getUserByEmail?: (value: string) => Promise<{ data: { user: { id: string } | null } | null; error: { message?: string } | null }>;
  };
  if (typeof adminAny.getUserByEmail === 'function') {
    const { data, error } = await adminAny.getUserByEmail(email);
    if (!error && data?.user?.id) return data.user.id;
  }

  const filtered = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey } },
  );
  if (filtered.ok) {
    const body = await filtered.json().catch(() => ({}));
    const users = Array.isArray(body?.users) ? body.users : Array.isArray(body) ? body : [];
    const match = users.find((user: { email?: string }) => String(user.email || '').toLowerCase() === email);
    if (match?.id) return String(match.id);
  }

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const found = (data.users || []).find((user) => String(user.email || '').toLowerCase() === email);
    if (found?.id) return found.id;
    if ((data.users || []).length < 200) break;
  }
  return null;
}

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status = 200) => jsonWith(corsHeaders, body, status);

  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Claim service is not configured.' }, 500);
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'Invalid JSON request body.' }, 400);
    }

    const token = String(payload.token || '').trim();
    const password = String(payload.password || '');
    const fullName = String(payload.fullName || '').trim();
    if (!token || token.length < 16 || token.length > 512) return json({ error: 'invalid_token' }, 400);
    const passwordError = invitePasswordPolicyError(password);
    if (passwordError) return json({ error: passwordError }, 400);
    if (!fullName || fullName.length > 200) return json({ error: 'Enter your name (200 characters or fewer).' }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Throttle gate (Review #247, requires migration 0017). Degrades
    // gracefully when the RPC is not deployed yet: proceed without the lock.
    try {
      const { data: gate } = await admin.rpc('venue_admin_claim_gate', { p_token: token });
      if (gate && typeof gate === 'object' && (gate as { locked?: boolean }).locked === true) {
        return json(
          { error: 'Too many attempts with this setup link. Wait a few minutes and try again.' },
          429,
        );
      }
    } catch {
      // venue_admin_claim_gate is not deployed yet — skip throttling.
    }

    const { data: contextRaw, error: contextError } = await admin.rpc('get_venue_admin_invite_context', {
      p_token: token,
    });
    if (contextError) {
      await registerClaimFailure(admin, token);
      return json({ error: contextError.message || 'not_found' }, 400);
    }
    const context = typeof contextRaw === 'string'
      ? asRecord((() => { try { return JSON.parse(contextRaw); } catch { return null; } })())
      : asRecord(contextRaw);
    if (!context?.ok) {
      await registerClaimFailure(admin, token);
      return json({ error: String(context?.error || 'not_found') }, 400);
    }

    const email = String(context.email || '').trim().toLowerCase();
    const organizationId = String(context.organization_id || '');
    const organizationName = String(context.organization_name || '');
    const organizationSlug = String(context.organization_slug || '');
    if (!email || !organizationId) return json({ error: 'not_found' }, 400);

    let existingUser = false;
    let userId: string | null = null;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (created.data.user?.id && !created.error) {
      userId = created.data.user.id;
    } else {
      const createMessage = created.error?.message || '';
      if (!alreadyRegistered(createMessage)) {
        return json({ error: createMessage || 'Could not create the venue administrator account.' }, 400);
      }
      existingUser = true;
      userId = await findAuthUserIdByEmail(admin, supabaseUrl, serviceRoleKey, email);
      if (!userId) {
        return json({ error: 'The invited email already has an account, but it could not be loaded to set a new password.' }, 400);
      }
      const updated = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (updated.error || !updated.data.user?.id) {
        return json({ error: updated.error?.message || 'Could not set a new password for this venue account.' }, 400);
      }
      try {
        const adminAny = admin.auth.admin as unknown as {
          signOut?: (id: string, scope?: string) => Promise<unknown>;
        };
        if (typeof adminAny.signOut === 'function') {
          await adminAny.signOut(userId, 'global');
        }
      } catch {
        // Password is already updated. Old sessions are best-effort.
      }
    }

    await admin.from('profiles').update({ full_name: fullName, email }).eq('id', userId);

    // Atomic claim (Review #247): consume the invite + transfer ownership in
    // one transaction now that credentials are set, instead of leaving the
    // invite pending until a client-side accept runs.
    const claimResult = await claimAtomically(admin, token, userId, email);
    if (claimResult.error) {
      return json({ error: claimResult.error }, 400);
    }

    return json({
      ok: true,
      email,
      existingUser,
      claimed: claimResult.ok,
      organizationId,
      organizationName,
      organizationSlug,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'claim-venue-admin failed.' }, 500);
  }
});
