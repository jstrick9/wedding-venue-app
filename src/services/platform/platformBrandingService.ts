import type { Config } from '../../types';
import { DEFAULT_PLATFORM_LOGIN_CONFIG, mergePlatformLoginBranding } from '../../utils/loginBranding';
import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';

function normalizeBranding(value: Record<string, unknown> | null | undefined): Config {
  return mergePlatformLoginBranding({
    ...DEFAULT_PLATFORM_LOGIN_CONFIG,
    ...(value || {}),
    venueName: String(value?.venueName || DEFAULT_PLATFORM_LOGIN_CONFIG.venueName),
    tagline: String(value?.tagline || DEFAULT_PLATFORM_LOGIN_CONFIG.tagline),
    location: String(value?.location || ''),
    websiteUrl: String(value?.websiteUrl || ''),
    supportEmail: String(value?.supportEmail || ''),
    logoUrl: String(value?.logoUrl || ''),
  });
}

export async function getPublicPlatformBranding(): Promise<Config> {
  if (!isSupabaseConfigured()) return normalizeBranding(null);
  const { data, error } = await getSupabaseClient().rpc('get_public_platform_branding');
  if (error || !data?.ok) return normalizeBranding(null);
  return normalizeBranding((data.branding || {}) as Record<string, unknown>);
}

export async function getPlatformBranding(): Promise<Config> {
  if (!isSupabaseConfigured()) return normalizeBranding(null);
  const { data, error } = await getSupabaseClient().from('platform_settings').select('branding').eq('id', 'default').maybeSingle();
  if (error || !data?.branding) return normalizeBranding(null);
  return normalizeBranding(data.branding as Record<string, unknown>);
}

export async function savePlatformBranding(branding: Config): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  const { data, error } = await getSupabaseClient().rpc('upsert_platform_branding', {
    p_branding: branding,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not save platform branding.'));
}
