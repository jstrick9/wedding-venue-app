import { isSupabaseConfigured } from './backend/supabaseClient';

/**
 * Runtime platform configuration.
 *
 * The app runs in one of two modes:
 *  - `local`   (default) — everything persisted to localStorage; works offline
 *    and with zero setup. Best for trying the app and single-device use.
 *  - `supabase` — a real multi-user Intelligence Platform backend: shared data
 *    (RLS-scoped), account auth, real-time collaboration, object storage, and
 *    transactional email. Requires VITE_BACKEND_PROVIDER=supabase plus
 *    Supabase URL/anon key env vars and the applied migration.
 */
export type PlatformProvider = 'local' | 'supabase';

export function getPlatformProvider(): PlatformProvider {
  return import.meta.env.VITE_BACKEND_PROVIDER === 'supabase' && isSupabaseConfigured()
    ? 'supabase'
    : 'local';
}

export function isPlatformEnabled(): boolean {
  return getPlatformProvider() === 'supabase';
}

export function platformLabel(): string {
  return isPlatformEnabled() ? 'Shared workspace' : 'This device';
}
