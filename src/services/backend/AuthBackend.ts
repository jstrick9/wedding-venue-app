import type { User, UserRole } from '../../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export interface BackendAuthSession {
  user: User;
  accessToken: string;
}

function mapRole(rawRole: unknown): UserRole {
  if (rawRole === 'admin' || rawRole === 'staff' || rawRole === 'guest') return rawRole;
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

export async function signInWithSupabase(
  email: string,
  password: string,
): Promise<BackendAuthSession | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  const user = mapProfileToUser(
    { ...profile, app_role: membership?.role },
    data.user.id,
    data.user.email || email,
  );

  return { user, accessToken: data.session.access_token };
}

export async function restoreSupabaseSession(): Promise<BackendAuthSession | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('role,status')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  return {
    user: mapProfileToUser(
      { ...profile, app_role: membership?.role },
      session.user.id,
      session.user.email || '',
    ),
    accessToken: session.access_token,
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

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', data.user.id)
    .maybeSingle();

  if (orgRow) {
    await supabase.from('organization_memberships').insert({
      organization_id: orgRow.id,
      user_id: data.user.id,
      role: 'owner',
      status: 'active',
    });
  }

  const session: BackendAuthSession = {
    user: mapProfileToUser(
      { full_name: fullName, app_role: 'admin' },
      data.user.id,
      data.user.email || email,
    ),
    accessToken: data.session.access_token,
  };
  return session;
}

export async function requestSupabasePasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}${window.location.pathname}#/password-reset`;
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}
