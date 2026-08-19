import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';

export async function uploadPublicBrandingAsset(
  file: File,
  scope: 'platform' | { organizationId: string },
): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  const bucket = 'public-branding';
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  const prefix = scope === 'platform' ? 'platform' : `venues/${scope.organizationId}`;
  const path = `${prefix}/${Date.now()}-${safeName}`;
  const { error } = await getSupabaseClient().storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;
  const { data } = getSupabaseClient().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
