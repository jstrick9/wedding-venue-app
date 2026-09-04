import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import { describeUnknownError } from '../../utils/unknownError';

export async function uploadPublicBrandingAsset(
  file: File,
  scope: 'platform' | { organizationId: string },
): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('This service is temporarily unavailable.');
  const bucket = 'public-branding';
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  const prefix = scope === 'platform' ? 'platform' : `venues/${scope.organizationId}`;
  const path = `${prefix}/${Date.now()}-${safeName}`;
  const { error } = await getSupabaseClient(scope === 'platform' ? 'platform' : 'venue').storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw new Error(describeUnknownError(error, 'Could not upload the branding image. Try again.'));
  const { data } = getSupabaseClient().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
