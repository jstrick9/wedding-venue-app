import { isSupabaseConfigured } from '../backend/supabaseClient';

export const CLAIM_VENUE_ADMIN_FUNCTION = 'claim-venue-admin';

export const CLAIM_FUNCTION_MISSING =
  'The venue claim service is not deployed yet. Wait for the claim-venue-admin Edge Function, refresh this page, and set a new password again. Venue events, layouts, guests, and team work are not deleted.';

export interface ClaimVenueAdminAccountResult {
  email: string;
  existingUser: boolean;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
}

function functionsUrl(name: string): string {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  return `${base}/functions/v1/${name}`;
}

function errorFromBody(body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const nested = (body as { error?: unknown }).error;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return '';
}

/**
 * Set or reset the invited venue administrator password using the invite token.
 * Does not create a new venue and does not delete venue artifacts.
 */
export async function claimVenueAdminAccount(params: {
  token: string;
  password: string;
  fullName: string;
}): Promise<ClaimVenueAdminAccountResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }
  const token = params.token.trim();
  const password = params.password;
  const fullName = params.fullName.trim();
  if (!token) throw new Error('This setup link is missing or incomplete.');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  if (!fullName) throw new Error('Enter your name.');

  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  let response: Response;
  try {
    response = await fetch(functionsUrl(CLAIM_VENUE_ADMIN_FUNCTION), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password, fullName }),
    });
  } catch {
    throw new Error(CLAIM_FUNCTION_MISSING);
  }

  const body = await response.json().catch(() => ({}));
  if (response.status === 404 || /not found|does not exist/i.test(errorFromBody(body))) {
    throw new Error(CLAIM_FUNCTION_MISSING);
  }
  if (!response.ok || !body || typeof body !== 'object' || (body as { ok?: unknown }).ok !== true) {
    throw new Error(errorFromBody(body) || 'Could not set the venue administrator password.');
  }

  const payload = body as Record<string, unknown>;
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) throw new Error('The claim service did not return the invited email.');
  return {
    email,
    existingUser: payload.existingUser === true,
    organizationId: String(payload.organizationId || payload.organization_id || ''),
    organizationName: String(payload.organizationName || payload.organization_name || ''),
    organizationSlug: String(payload.organizationSlug || payload.organization_slug || ''),
  };
}

export function isClaimFunctionMissingError(error: unknown): boolean {
  return error instanceof Error && error.message === CLAIM_FUNCTION_MISSING;
}
