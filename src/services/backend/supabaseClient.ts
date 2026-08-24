import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEYS, type AuthSurface, detectAuthSurface } from '../../utils/authSurface';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const clients: Partial<Record<AuthSurface, SupabaseClient>> = {};
let currentSurface: AuthSurface = detectAuthSurface();
let migratedLegacy = false;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function setAuthSurface(surface: AuthSurface): void {
  currentSurface = surface;
}

export function getAuthSurface(): AuthSurface {
  return currentSurface;
}

function createSurfaceClient(surface: AuthSurface): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: surface === 'platform',
      storageKey: AUTH_STORAGE_KEYS[surface],
    },
  });
}

export function getSupabaseClient(surface: AuthSurface = currentSurface): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }

  if (!clients[surface]) {
    clients[surface] = createSurfaceClient(surface);
  }

  return clients[surface]!;
}

function findLegacySupabaseAuthKey(): string | null {
  if (typeof localStorage === 'undefined') return null;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key === AUTH_STORAGE_KEYS.platform || key === AUTH_STORAGE_KEYS.venue) continue;
    if (key.startsWith('sb-') && key.endsWith('-auth-token')) return key;
  }
  return null;
}

/**
 * Copy the pre-#209 single session onto the matching surface client(s).
 * Platform-only operators stay on the platform key so an invite page does not
 * treat them as the venue administrator.
 */
export async function migrateLegacyAuthSessions(): Promise<void> {
  if (migratedLegacy || !isSupabaseConfigured() || typeof localStorage === 'undefined') return;
  migratedLegacy = true;

  const hasSplit =
    Boolean(localStorage.getItem(AUTH_STORAGE_KEYS.platform)) ||
    Boolean(localStorage.getItem(AUTH_STORAGE_KEYS.venue));
  if (hasSplit) return;

  const legacyKey = findLegacySupabaseAuthKey();
  if (!legacyKey) return;

  const legacy = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: legacyKey,
    },
  });
  const { data } = await legacy.auth.getSession();
  const session = data.session;
  if (!session?.user) return;

  const tokens = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };

  const { data: platformRow } = await legacy
    .from('platform_memberships')
    .select('role,status')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .maybeSingle();
  const { data: membership } = await legacy
    .from('organization_memberships')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (platformRow?.role) {
    await getSupabaseClient('platform').auth.setSession(tokens);
  }
  if (membership) {
    await getSupabaseClient('venue').auth.setSession(tokens);
  }
  if (!platformRow?.role && !membership) {
    await getSupabaseClient('platform').auth.setSession(tokens);
  }

  await legacy.auth.signOut({ scope: 'local' });
}

export async function getCurrentAccessToken(surface?: AuthSurface): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await getSupabaseClient(surface).auth.getSession();
  return data.session?.access_token ?? null;
}
