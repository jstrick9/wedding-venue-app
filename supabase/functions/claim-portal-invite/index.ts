// Supabase Edge Function: claim-portal-invite
// Creates a confirmed Auth account for an email-backed couple/collaborator/guest
// invitation, then binds that user to the exact portal participant via migration
// 0021. Existing Auth users are never password-reset by an RSVP/planning invite;
// they must prove ownership by signing in with their existing password.
//
// Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (provided by Supabase).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
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

function alreadyRegistered(message: string): boolean {
  return /already registered|already been registered|user already exists|email_exists|already exists/i.test(message);
}

serve(async (request) => {
  const corsHeaders = corsHeadersFor(request);
  const json = (body: unknown, status = 200) => jsonWith(corsHeaders, body, status);

  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Portal claim service is not configured.' }, 500);
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload) return json({ error: 'Invalid JSON request body.' }, 400);

    const kind = String(payload.kind || '').trim().toLowerCase();
    const token = String(payload.token || '').trim();
    const coupleId = String(payload.coupleId || '').trim() || null;
    const venueSlug = String(payload.venueSlug || '').trim() || null;
    const password = String(payload.password || '');
    const fullName = String(payload.fullName || '').trim();

    if (kind !== 'couple' && kind !== 'guest') {
      return json({ error: 'invalid_invite_kind' }, 400);
    }
    if (token.length < 16 || token.length > 512) {
      return json({ error: 'invalid_token' }, 400);
    }
    if ((kind === 'guest' && !coupleId) || (coupleId?.length || 0) > 200 || (venueSlug?.length || 0) > 200) {
      return json({ error: 'invalid_token' }, 400);
    }
    const passwordError = invitePasswordPolicyError(password);
    if (passwordError) return json({ error: passwordError }, 400);
    if (!fullName || fullName.length > 200) {
      return json({ error: 'Enter your full name (200 characters or fewer).' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: contextRaw, error: contextError } = await admin.rpc('get_portal_invite_context', {
      p_kind: kind,
      p_token: token,
      p_couple_id: coupleId,
      p_venue_slug: venueSlug,
    });
    if (contextError) {
      return json({ error: contextError.message || 'not_found' }, 400);
    }
    const context = typeof contextRaw === 'string'
      ? asRecord((() => { try { return JSON.parse(contextRaw); } catch { return null; } })())
      : asRecord(contextRaw);
    if (!context?.ok) {
      return json({ error: String(context?.error || 'not_found') }, 400);
    }
    if (context.account_required !== true) {
      return json({ error: 'email_required' }, 400);
    }

    const email = String(context.email || '').trim().toLowerCase();
    if (!email) return json({ error: 'email_required' }, 400);
    if (context.account_claimed === true) {
      return json({ error: 'account_exists', context }, 409);
    }

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        portal_kind: kind,
      },
    });
    if (created.error || !created.data.user?.id) {
      const message = created.error?.message || '';
      if (alreadyRegistered(message)) {
        return json({ error: 'account_exists', context }, 409);
      }
      return json({ error: message || 'Could not create the portal account.' }, 400);
    }

    const userId = created.data.user.id;
    const { data: claimRaw, error: claimError } = await admin.rpc('claim_portal_invite_account', {
      p_kind: kind,
      p_token: token,
      p_couple_id: coupleId,
      p_user_id: userId,
      p_email: email,
      p_full_name: fullName,
    });
    const claim = typeof claimRaw === 'string'
      ? asRecord((() => { try { return JSON.parse(claimRaw); } catch { return null; } })())
      : asRecord(claimRaw);
    if (claimError || !claim?.ok) {
      // The Auth user was created solely for this claim. Remove the orphan if
      // the binding transaction rejects (expired/revoked/raced invitation).
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      return json({ error: claimError?.message || String(claim?.error || 'claim_failed') }, 400);
    }

    return json({
      ok: true,
      email,
      existingUser: false,
      context: claim,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'claim-portal-invite failed.' }, 500);
  }
});
