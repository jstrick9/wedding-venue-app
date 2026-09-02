import type { User, UserRole } from '../../types';
import type { AuthSurface } from '../../utils/authSurface';
import type { PlatformRole } from '../platform/platformTypes';
import { claimVenueAdminAccount, isClaimFunctionMissingError } from '../platform/claimVenueAdminAccount';
import { buildPasswordResetRedirectUrl, type PasswordResetSurface } from '../../utils/passwordResetRoute';
import { describePasswordPolicyError } from '../../utils/passwordPolicy';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export interface BackendAuthSession {
  user: User;
  accessToken: string;
  /** The user's active organization id (RLS scope) when known. */
  organizationId?: string;
  /** Slug for the active venue organization, used in venue-specific routes. */
  organizationSlug?: string;
  /** A global platform role, separate from the user's venue organization role. */
  platformRole?: PlatformRole;
}

function mapRole(rawRole: unknown): UserRole {
  // Supabase has an explicit owner role; the local UI's admin role is the
  // equivalent authority for the single-venue product.
  if (rawRole === 'owner' || rawRole === 'admin') return 'admin';
  if (rawRole === 'staff') return 'staff';
  if (rawRole === 'guest') return 'guest';
  return 'basic';
}

function mapProfileToUser(profile: any, authUserId: string, authEmail: string): User {
  const email = String(profile?.email || authEmail || '');
  return {
    id: authUserId,
    username: email,
    email,
    password: '',
    role: mapRole(profile?.app_role || profile?.role),
    name: profile?.full_name || email || 'User',
    phone: profile?.phone || '',
    contactPhoneNumber: profile?.phone || '',
    phoneType: 'Mobile',
    preferredCommunication: ['email'],
    userStatus: 'active',
    isActive: true,
    createdAt: profile?.created_at || new Date().toISOString(),
    updatedAt: profile?.updated_at,
    assignedRoles: profile?.app_role ? [profile.app_role] : undefined,
    sessionVersion: 1,
  };
}

export function shouldUseSupabaseAuth(): boolean {
  return import.meta.env.VITE_BACKEND_PROVIDER === 'supabase' && isSupabaseConfigured();
}

async function loadPlatformRole(userId: string, surface: AuthSurface): Promise<PlatformRole | undefined> {
  const { data, error } = await getSupabaseClient(surface)
    .from('platform_memberships')
    .select('role,status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !data?.role) return undefined;
  return data.role as PlatformRole;
}

function hasPlatformAdminAuthority(platformRole?: PlatformRole): boolean {
  return platformRole === 'platform_owner' || platformRole === 'platform_admin';
}

/** Provisioning venues must stay sign-in-able after the invitee claims them. */
function isVenueAccessBlocked(status?: string | null): boolean {
  return status === 'suspended' || status === 'archived';
}

export async function signInWithSupabase(
  email: string,
  password: string,
  requiredOrganizationId?: string,
  surface?: AuthSurface,
): Promise<BackendAuthSession | null> {
  const target: AuthSurface = surface || (requiredOrganizationId ? 'venue' : 'platform');
  const supabase = getSupabaseClient(target);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  const membershipQuery = supabase
    .from('organization_memberships')
    .select('role,status,organization_id')
    .eq('user_id', data.user.id)
    .eq('status', 'active');
  const { data: membership } = await (requiredOrganizationId
    ? membershipQuery.eq('organization_id', requiredOrganizationId)
    : membershipQuery.limit(1)
  ).maybeSingle();

  if (requiredOrganizationId && !membership) {
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }

  const { data: organization } = membership?.organization_id
    ? await supabase
      .from('organizations')
      .select('slug,status')
      .eq('id', membership.organization_id)
      .maybeSingle()
    : { data: null };
  const blocked = isVenueAccessBlocked(organization?.status);
  if (requiredOrganizationId && blocked) {
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }
  const effectiveMembership = blocked ? null : membership;
  const platformRole = await loadPlatformRole(data.user.id, target);
  const user = mapProfileToUser(
    {
      ...profile,
      app_role: hasPlatformAdminAuthority(platformRole) ? 'admin' : effectiveMembership?.role,
    },
    data.user.id,
    data.user.email || email,
  );

  return {
    user,
    accessToken: data.session.access_token,
    organizationId: effectiveMembership?.organization_id,
    organizationSlug: blocked ? undefined : organization?.slug,
    platformRole,
  };
}

export async function restoreSupabaseSession(
  requiredOrganizationId?: string,
  surface: AuthSurface = 'platform',
): Promise<BackendAuthSession | null> {
  const supabase = getSupabaseClient(surface);
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  const membershipQuery = supabase
    .from('organization_memberships')
    .select('role,status,organization_id')
    .eq('user_id', session.user.id)
    .eq('status', 'active');
  const { data: membership } = await (requiredOrganizationId
    ? membershipQuery.eq('organization_id', requiredOrganizationId)
    : membershipQuery.limit(1)
  ).maybeSingle();

  if (requiredOrganizationId && !membership) return null;

  const { data: organization } = membership?.organization_id
    ? await supabase
      .from('organizations')
      .select('slug,status')
      .eq('id', membership.organization_id)
      .maybeSingle()
    : { data: null };
  const blocked = isVenueAccessBlocked(organization?.status);
  if (blocked && surface === 'venue') {
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }
  if (requiredOrganizationId && blocked) return null;
  const effectiveMembership = blocked ? null : membership;
  const platformRole = await loadPlatformRole(session.user.id, surface);
  return {
    user: mapProfileToUser(
      {
        ...profile,
        app_role: hasPlatformAdminAuthority(platformRole) ? 'admin' : effectiveMembership?.role,
      },
      session.user.id,
      session.user.email || '',
    ),
    accessToken: session.access_token,
    organizationId: effectiveMembership?.organization_id,
    organizationSlug: blocked ? undefined : organization?.slug,
    platformRole,
  };
}

export async function signOutSupabase(
  surface?: AuthSurface,
  options?: { scope?: 'local' | 'global' },
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getSupabaseClient(surface).auth.signOut({ scope: options?.scope ?? 'global' });
}

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  /** Display name for the new organization (defaults to the user's name). */
  organizationName?: string;
}

function slugify(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Create a new auth user via Supabase Auth, then bootstrap a personal
 * organization + admin membership for them (the profiles row is created by the
 * `handle_new_user` trigger in the migration). This is the entry point for
 * turning the app into a multi-tenant platform: every new user gets their own
 * org scope and RLS picks it up automatically.
 */
export async function signUpWithSupabase({
  email,
  password,
  fullName,
  organizationName,
}: SignUpParams): Promise<BackendAuthSession> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  if (!data.session || !data.user) {
    throw new Error('Sign-up succeeded but no session was returned (email confirmation may be required).');
  }

  // Bootstrap an organization + owner membership so the new user has an RLS
  // scope. The profile row was created by the auth trigger.
  const orgName = (organizationName || fullName || email.split('@')[0]).trim() || 'My Venue';
  const { error: orgError } = await supabase
    .from('organizations')
    .insert({ name: orgName, slug: slugify(orgName), owner_id: data.user.id });
  if (orgError) throw orgError;

  const { data: orgRow, error: orgLookupError } = await supabase
    .from('organizations')
    .select('id,slug')
    .eq('owner_id', data.user.id)
    .maybeSingle();
  if (orgLookupError || !orgRow) {
    throw orgLookupError || new Error('Organization bootstrap did not return an organization.');
  }

  const { error: membershipError } = await supabase.from('organization_memberships').insert({
    organization_id: orgRow.id,
    user_id: data.user.id,
    role: 'owner',
    status: 'active',
  });
  if (membershipError) throw membershipError;

  const session: BackendAuthSession = {
    user: mapProfileToUser(
      { full_name: fullName, app_role: 'admin' },
      data.user.id,
      data.user.email || email,
    ),
    accessToken: data.session.access_token,
    organizationId: orgRow?.id,
    organizationSlug: orgRow?.slug,
  };
  return session;
}

export interface VenueAdminInviteSignUpParams {
  email: string;
  password: string;
  fullName: string;
  inviteToken: string;
}

function alreadyRegisteredMessage(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /already registered|already been registered|user already exists|email_exists|already exists/i.test(message);
}

async function acceptVenueAdminInviteAsSignedIn(
  inviteToken: string,
  fullName: string,
): Promise<BackendAuthSession> {
  const supabase = getSupabaseClient('venue');
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const email = userData.user?.email || '';
  if (!userId) {
    throw new Error('Venue administrator access was saved, but the session could not be restored.');
  }
  if (fullName.trim()) {
    await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', userId);
  }

  const { data: accepted, error: acceptError } = await supabase.rpc('accept_venue_admin_invite', {
    p_token: inviteToken,
  });
  if (acceptError) throw acceptError;
  if (!accepted?.ok) {
    throw new Error(String(accepted?.error || 'The venue administrator invitation could not be accepted.'));
  }

  const { data: sessionData } = await supabase.auth.getSession();
  return {
    user: mapProfileToUser(
      { full_name: fullName, app_role: 'admin' },
      userId,
      email,
    ),
    accessToken: sessionData.session?.access_token || '',
    organizationId: String(accepted.organization_id || ''),
    organizationSlug: accepted.organization_slug ? String(accepted.organization_slug) : undefined,
  };
}

async function signUpVenueAdminFallback({
  email,
  password,
  fullName,
  inviteToken,
}: VenueAdminInviteSignUpParams): Promise<BackendAuthSession> {
  const supabase = getSupabaseClient('venue');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  if (!data.session || !data.user) {
    throw new Error('Account created but no session was returned. Email confirmation may be enabled; complete confirmation or use a test project with confirmation disabled.');
  }
  return acceptVenueAdminInviteAsSignedIn(inviteToken, fullName);
}

/**
 * Create or re-claim the managed administrator for a platform-created venue.
 * A reissued invite sets a new password on the existing Auth user and then
 * accepts the invite. The organization and its artifacts stay in place.
 */
export async function signUpVenueAdminWithInvite({
  email,
  password,
  fullName,
  inviteToken,
}: VenueAdminInviteSignUpParams): Promise<BackendAuthSession> {
  const passwordError = describePasswordPolicyError(password);
  if (passwordError) throw new Error(passwordError);
  try {
    const prepared = await claimVenueAdminAccount({
      token: inviteToken,
      password,
      fullName,
    });
    const supabase = getSupabaseClient('venue');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: prepared.email || email,
      password,
    });
    if (error || !data.session || !data.user) {
      throw new Error(error?.message || 'Could not sign in with the new venue password.');
    }
    // Migration 0017 path: the Edge Function consumed the invite atomically
    // (ownership transfer + membership + audit) right after setting the
    // password, so the client-side accept RPC would be redundant. Build the
    // session from the claim response instead of another round-trip that
    // could transiently fail after a successful claim.
    if (prepared.claimed) {
      return {
        user: mapProfileToUser(
          { full_name: fullName, app_role: 'admin' },
          data.user.id,
          data.user.email || prepared.email,
        ),
        accessToken: data.session.access_token,
        organizationId: prepared.organizationId,
        organizationSlug: prepared.organizationSlug || undefined,
      };
    }
    return acceptVenueAdminInviteAsSignedIn(inviteToken, fullName);
  } catch (error) {
    if (!isClaimFunctionMissingError(error)) throw error;
    try {
      return await signUpVenueAdminFallback({ email, password, fullName, inviteToken });
    } catch (fallbackError) {
      if (alreadyRegisteredMessage(fallbackError)) {
        throw new Error(
          'This venue already has an administrator account. The claim-venue-admin function must be deployed so a reissued invite can set a new password without losing venue work.',
        );
      }
      throw fallbackError;
    }
  }
}

export async function signUpOrganizationInvite({
  email,
  password,
  fullName,
  inviteToken,
}: VenueAdminInviteSignUpParams): Promise<BackendAuthSession> {
  const supabase = getSupabaseClient('venue');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  if (!data.session || !data.user) {
    throw new Error('Account created but no session was returned. Email confirmation may be enabled; complete confirmation or use a test project with confirmation disabled.');
  }

  const { data: accepted, error: acceptError } = await supabase.rpc('accept_invite', {
    p_token: inviteToken,
  });
  if (acceptError) throw acceptError;
  if (!accepted?.ok) {
    throw new Error(String(accepted?.error || 'The organization invitation could not be accepted.'));
  }

  const session = await restoreSupabaseSession(undefined, 'venue');
  if (!session) throw new Error('Account was created, but the organization session could not be restored.');
  return session;
}

export async function requestSupabasePasswordReset(
  email: string,
  surface: PasswordResetSurface = 'platform',
): Promise<void> {
  const redirectTo = buildPasswordResetRedirectUrl(surface);
  const { error } = await getSupabaseClient(surface).auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}

export async function completeSupabasePasswordRecovery(params: {
  surface: PasswordResetSurface;
  password: string;
  code?: string;
  accessToken?: string;
  refreshToken?: string;
}): Promise<void> {
  if (params.password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
  const supabase = getSupabaseClient(params.surface);
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw new Error(error.message || 'This reset link is invalid or already used.');
  } else if (params.accessToken && params.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (error) throw new Error(error.message || 'This reset link is invalid or already used.');
  } else {
    throw new Error(
      'This reset link is missing or incomplete. Request a new password reset and open the newest email in this same browser.',
    );
  }
  const { error } = await supabase.auth.updateUser({ password: params.password });
  if (error) throw new Error(error.message || 'Could not update the password.');
}
