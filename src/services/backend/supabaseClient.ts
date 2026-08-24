import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  AUTH_STORAGE_KEYS,
  type AuthSurface,
  detectAuthSurface,
  surfacesForLegacySession,
} from '../../utils/authSurface';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const clients: Partial<Record<AuthSurface, SupabaseClient>> = {};
let currentSurface: AuthSurface = detectAuthSurface();
let migratedLegacy = false;

export const PLATFORM_SESSION_MISSING =
  'Your platform administrator session is missing or expired. Sign in again at Platform login. Venue setup uses a separate account and does not replace the platform login.';

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function setAuthSurface(surface: AuthSurface): void {
  const previous = currentSurface;
  currentSurface = surface;
  if (!isSupabaseConfigured() || previous === surface) return;
  if (clients[previous]) void clients[previous]!.auth.stopAutoRefresh();
  if (clients[surface]) void clients[surface]!.auth.startAutoRefresh();
}

export function getAuthSurface(): AuthSurface {
  return currentSurface;
}

function createSurfaceClient(surface: AuthSurface): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: surface === currentSurface,
      detectSessionInUrl: false,
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

export async function requirePlatformClient(): Promise<SupabaseClient> {
  const client = getSupabaseClient('platform');
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) {
    throw new Error(PLATFORM_SESSION_MISSING);
  }
  return client;
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
 * Copy the pre-#209 single session onto one surface only.
 * The same refresh token must never live on both clients.
 */
export async function migrateLegacyAuthSessions(): Promise<void> {
  if (migratedLegacy || !isSupabaseConfigured() || typeof localStorage === 'undefined') return;
  migratedLegacy = true;

  const hasPlatform = Boolean(localStorage.getItem(AUTH_STORAGE_KEYS.platform));
  const hasVenue = Boolean(localStorage.getItem(AUTH_STORAGE_KEYS.venue));
  if (hasPlatform || hasVenue) return;

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

  const targets = surfacesForLegacySession(Boolean(platformRow?.role), Boolean(membership));
  for (const target of targets) {
    await getSupabaseClient(target).auth.setSession(tokens);
  }

  await legacy.auth.signOut({ scope: 'local' });
}

export async function getCurrentAccessToken(surface?: AuthSurface): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await getSupabaseClient(surface ?? currentSurface).auth.getSession();
  return data.session?.access_token ?? null;
}
