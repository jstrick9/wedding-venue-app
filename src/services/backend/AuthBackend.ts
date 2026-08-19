import type { User, UserRole } from '../../types';
import type { PlatformRole } from '../platform/platformTypes';
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

async function loadPlatformRole(userId: string): Promise<PlatformRole | undefined> {
  const { data, error } = await getSupabaseClient()
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

export async function signInWithSupabase(
  email: string,
  password: string,
  requiredOrganizationId?: string,
): Promise<BackendAuthSession | null> {
  const supabase = getSupabaseClient();
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

  if (requiredOrganizationId && !membership) return null;

  const { data: organization } = membership?.organization_id
    ? await supabase
      .from('organizations')
      .select('slug,status')
      .eq('id', membership.organization_id)
      .maybeSingle()
    : { data: null };
  const organizationActive = !organization?.status || organization.status === 'active';
  if (requiredOrganizationId && !organizationActive) return null;
  const effectiveMembership = organizationActive ? membership : null;
  const platformRole = await loadPlatformRole(data.user.id);
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
    organizationSlug: organizationActive ? organization?.slug : undefined,
    platformRole,
  };
}

export async function restoreSupabaseSession(requiredOrganizationId?: string): Promise<BackendAuthSession | null> {
  const supabase = getSupabaseClient();
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
  const organizationActive = !organization?.status || organization.status === 'active';
  if (requiredOrganizationId && !organizationActive) return null;
  const effectiveMembership = organizationActive ? membership : null;
  const platformRole = await loadPlatformRole(session.user.id);
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
    organizationSlug: organizationActive ? organization?.slug : undefined,
    platformRole,
  };
}

export async function signOutSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getSupabaseClient().auth.signOut();
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

/**
 * Create the first managed administrator for a platform-created venue. Unlike
 * ordinary platform sign-up, this never creates a new organization; the
 * invitation claims the organization created by the platform administrator.
 */
export async function signUpVenueAdminWithInvite({
  email,
  password,
  fullName,
  inviteToken,
}: VenueAdminInviteSignUpParams): Promise<BackendAuthSession> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  if (!data.session || !data.user) {
    throw new Error('Account created but no session was returned. Email confirmation may be enabled; complete confirmation or use a test project with confirmation disabled.');
  }

  const { data: accepted, error: acceptError } = await supabase.rpc('accept_venue_admin_invite', {
    p_token: inviteToken,
  });
  if (acceptError) throw acceptError;
  if (!accepted?.ok) {
    throw new Error(String(accepted?.error || 'The venue administrator invitation could not be accepted.'));
  }

  const session = await restoreSupabaseSession();
  if (!session) throw new Error('Venue administrator account was created, but the session could not be restored.');
  return session;
}

export async function signUpOrganizationInvite({
  email,
  password,
  fullName,
  inviteToken,
}: VenueAdminInviteSignUpParams): Promise<BackendAuthSession> {
  const supabase = getSupabaseClient();
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

  const session = await restoreSupabaseSession();
  if (!session) throw new Error('Account was created, but the organization session could not be restored.');
  return session;
}

export async function requestSupabasePasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}${window.location.pathname}#/password-reset`;
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}
