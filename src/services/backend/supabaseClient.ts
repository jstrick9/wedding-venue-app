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

/**
 * Hard deadline (ms) for every Supabase REST/Auth/Storage request made by the
 * browser clients. This is the root fix for the "must not hang" class from
 * Reviews #214–#244: a stalled request aborts instead of parking a pending
 * promise forever. UI-level `withTimeout` calls remain for user-facing busy
 * states, but no service call can hang past this deadline anymore.
 */
export const SUPABASE_FETCH_DEADLINE_MS = Number(
  import.meta.env.VITE_SUPABASE_FETCH_DEADLINE_MS || 30_000,
);

/**
 * Wraps `fetch` so every request aborts at the deadline. Built on a manual
 * `AbortController` + timer (not `AbortSignal.timeout`) so behavior is
 * identical across modern browsers and test environments. An explicit caller
 * signal is bridged onto the same controller so caller-initiated aborts still
 * work and still fire before the deadline.
 */
export function createDeadlineFetch(deadlineMs: number = SUPABASE_FETCH_DEADLINE_MS): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deadlineMs);
    const externalSignal = init?.signal;
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener(
          'abort',
          () => controller.abort(),
          { once: true },
        );
      }
    }
    return fetch(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
    });
  };
}

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

export function clearPersistedAuthSurface(surface: AuthSurface): string | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const key = AUTH_STORAGE_KEYS[surface];
  let accessToken: string | undefined;
  try {
    const persisted = localStorage.getItem(key);
    if (persisted && persisted.length <= 100_000) {
      const parsed = JSON.parse(persisted) as { access_token?: unknown };
      if (typeof parsed?.access_token === 'string' && parsed.access_token.length <= 10_000) {
        accessToken = parsed.access_token;
      }
    }
  } catch {
    // A corrupt record has no usable revocation token; it is still removed below.
  }
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}-code-verifier`);
  } catch {
    // In-memory auth state is still cleared by the caller. Authorization remains
    // server-enforced if browser storage is unavailable.
  }
  return accessToken;
}

function createSurfaceClient(surface: AuthSurface): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: surface === currentSurface,
      detectSessionInUrl: false,
      storageKey: AUTH_STORAGE_KEYS[surface],
    },
    global: {
      // Every request gets a hard abort deadline (Review #245 P1-A) so no
      // service-layer call can hang forever, regardless of caller.
      fetch: createDeadlineFetch(),
    },
  });
}

export function getSupabaseClient(surface: AuthSurface = currentSurface): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'This service is temporarily unavailable. Contact support for help.',
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
    if (Object.values(AUTH_STORAGE_KEYS).includes(key)) continue;
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
    global: {
      fetch: createDeadlineFetch(),
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

  // The destination contains this same refresh token. Calling Auth signOut on
  // the legacy client would revoke the token we just migrated; remove only the
  // obsolete storage keys instead.
  try {
    localStorage.removeItem(legacyKey);
    localStorage.removeItem(`${legacyKey}-code-verifier`);
  } catch {
    // The destination session remains server-authorized even if obsolete local
    // storage cannot be removed in this browser.
  }
}

export async function getCurrentAccessToken(surface?: AuthSurface): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await getSupabaseClient(surface ?? currentSurface).auth.getSession();
  return data.session?.access_token ?? null;
}
