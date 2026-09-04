import type { AuthSurface } from '../../utils/authSurface';
import { describePasswordPolicyError } from '../../utils/passwordPolicy';
import { createDeadlineFetch, getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import { signOutSupabase } from '../backend/AuthBackend';

export type PortalInviteKind = 'couple' | 'guest';
export type PortalAccountMode = 'create' | 'sign-in';

export interface PortalInviteContext {
  kind: PortalInviteKind;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  coupleId: string;
  coupleName: string;
  participantType: 'couple' | 'collaborator' | 'guest';
  participantId: string;
  email: string;
  fullName: string;
  role: string;
  expiresAt?: string;
  accountRequired: boolean;
  accountClaimed: boolean;
  authenticated: boolean;
}

export interface PortalInviteLookupResult {
  /** False when migration 0021 is not deployed; callers may use legacy links. */
  available: boolean;
  context: PortalInviteContext | null;
  error?: string;
}

export const CLAIM_PORTAL_INVITE_FUNCTION = 'claim-portal-invite';
export const CLAIM_PORTAL_FUNCTION_MISSING =
  'Personal account setup is temporarily unavailable. Please try again later or contact the invitation sender.';

function surfaceFor(kind: PortalInviteKind): AuthSurface {
  return kind === 'couple' ? 'couple' : 'guest';
}

function mapContext(value: unknown): PortalInviteContext | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (row.ok !== true) return null;
  const kind = String(row.kind || '');
  if (kind !== 'couple' && kind !== 'guest') return null;
  return {
    kind,
    organizationId: String(row.organization_id || ''),
    organizationName: String(row.organization_name || ''),
    organizationSlug: String(row.organization_slug || ''),
    coupleId: String(row.couple_id || ''),
    coupleName: String(row.couple_name || ''),
    participantType: String(row.participant_type || '') as PortalInviteContext['participantType'],
    participantId: String(row.participant_id || ''),
    email: String(row.email || '').trim().toLowerCase(),
    fullName: String(row.full_name || '').trim(),
    role: String(row.role || ''),
    expiresAt: row.expires_at ? String(row.expires_at) : undefined,
    accountRequired: row.account_required === true,
    accountClaimed: row.account_claimed === true,
    authenticated: row.authenticated === true,
  };
}

function rpcUnavailable(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error
    && (
      error.code === 'PGRST202'
      || /schema cache|could not find the function/i.test(error.message || '')
    )
  );
}

export async function lookupPortalInviteContext(params: {
  kind: PortalInviteKind;
  token: string;
  coupleId?: string;
  venueSlug?: string;
}): Promise<PortalInviteLookupResult> {
  if (!isSupabaseConfigured()) return { available: false, context: null };
  const token = params.token.trim();
  if (!token) return { available: true, context: null, error: 'missing' };

  const { data, error } = await getSupabaseClient(surfaceFor(params.kind)).rpc(
    'get_portal_invite_context',
    {
      p_kind: params.kind,
      p_token: token,
      p_couple_id: params.coupleId || null,
      p_venue_slug: params.venueSlug || null,
    },
  );
  if (rpcUnavailable(error)) return { available: false, context: null };
  if (error) return { available: true, context: null, error: error.message || 'not_found' };
  const context = mapContext(data);
  if (!context) {
    const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    return { available: true, context: null, error: String(payload.error || 'not_found') };
  }
  return { available: true, context };
}

function functionsUrl(name: string): string {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  return `${base}/functions/v1/${name}`;
}

function responseError(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const error = (body as { error?: unknown }).error;
  return typeof error === 'string' ? error.trim() : '';
}

function describeAcceptError(error: string): string {
  if (error === 'email_mismatch') return 'Sign in with the email address shown on this invitation.';
  if (error === 'already_claimed') return 'This invitation is already tied to another account.';
  if (error === 'expired') return 'This invitation has expired. Ask for a new link.';
  if (error === 'venue_unavailable') return 'This venue portal is not currently available.';
  if (error === 'email_required') return 'Ask the sender to add a valid email address and reissue this personal account invitation.';
  if (error === 'account_required') return 'Sign in with your personal password to continue.';
  if (error === 'not_found') return 'This invitation is invalid or has been replaced by a newer link.';
  return 'Could not connect this account to the invitation. Request a new link or contact the invitation sender.';
}

async function signInAndAccept(params: {
  kind: PortalInviteKind;
  token: string;
  coupleId?: string;
  email: string;
  password: string;
  fullName: string;
}): Promise<PortalInviteContext> {
  const client = getSupabaseClient(surfaceFor(params.kind));
  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });
  if (signInError || !signedIn.session || !signedIn.user) {
    throw new Error(
      'That password did not sign in to the invited email account. Use your existing Wedding VIP password, or choose Forgot password on the main sign-in screen and then reopen this invitation.',
    );
  }

  const { data, error } = await client.rpc('accept_portal_invite', {
    p_kind: params.kind,
    p_token: params.token,
    p_couple_id: params.coupleId || null,
    p_full_name: params.fullName,
  });
  const context = mapContext(data);
  if (error || !context) {
    await signOutSupabase(surfaceFor(params.kind), { scope: 'local' });
    const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    throw new Error(describeAcceptError(String(payload.error || error?.message || '')));
  }
  return context;
}

export async function claimOrSignInPortalInvite(params: {
  kind: PortalInviteKind;
  mode: PortalAccountMode;
  token: string;
  coupleId?: string;
  venueSlug?: string;
  email: string;
  password: string;
  fullName: string;
}): Promise<PortalInviteContext> {
  if (!isSupabaseConfigured()) throw new Error(CLAIM_PORTAL_FUNCTION_MISSING);
  const token = params.token.trim();
  const email = params.email.trim().toLowerCase();
  const fullName = params.fullName.trim();
  if (!token) throw new Error('This invitation link is missing or incomplete.');
  if (!email) throw new Error('This invitation does not have an email address.');
  if (!fullName) throw new Error('Enter your full name.');

  if (params.mode === 'create') {
    const passwordError = describePasswordPolicyError(params.password);
    if (passwordError) throw new Error(passwordError);

    const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
    let response: Response;
    try {
      response = await createDeadlineFetch()(functionsUrl(CLAIM_PORTAL_INVITE_FUNCTION), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: params.kind,
          token,
          coupleId: params.coupleId || null,
          venueSlug: params.venueSlug || null,
          password: params.password,
          fullName,
        }),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Personal account setup timed out. Check your connection and try again.');
      }
      throw new Error('Could not reach personal account setup. Check your connection and try again.');
    }

    const body = await response.json().catch(() => ({}));
    const bodyError = responseError(body);
    if (response.status === 404 || /not found|does not exist/i.test(bodyError)) {
      throw new Error(CLAIM_PORTAL_FUNCTION_MISSING);
    }
    if (!response.ok && bodyError !== 'account_exists') {
      throw new Error(describeAcceptError(bodyError));
    }
  }

  return signInAndAccept({
    kind: params.kind,
    token,
    coupleId: params.coupleId,
    email,
    password: params.password,
    fullName,
  });
}

export async function signOutPortalAccount(kind: PortalInviteKind): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await signOutSupabase(surfaceFor(kind), { scope: 'local' });
}
