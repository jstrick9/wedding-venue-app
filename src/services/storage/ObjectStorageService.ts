import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import { describeUnknownError } from '../../utils/unknownError';

export type StorageBucket = 'venue-images' | 'venue-map-images' | 'event-documents' | 'user-avatars';

export interface UploadedObject {
  bucket: StorageBucket;
  path: string;
  signedUrl?: string;
}

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'upload';
}

export async function uploadObject(params: {
  bucket: StorageBucket;
  file: File | Blob;
  organizationId?: string;
  eventId?: string;
  userId?: string;
  filename?: string;
  contentType?: string;
}): Promise<UploadedObject> {
  if (!isSupabaseConfigured()) {
    throw new Error('File storage is temporarily unavailable.');
  }

  const supabase = getSupabaseClient();
  const originalName = params.filename || (params.file instanceof File ? params.file.name : 'upload');
  const filename = `${Date.now()}-${sanitizeFilename(originalName)}`;

  const path =
    params.bucket === 'user-avatars'
      ? `${params.userId || 'unknown'}/${filename}`
      : params.bucket === 'event-documents'
        ? `${params.organizationId}/${params.eventId || 'general'}/${filename}`
        : `${params.organizationId}/${filename}`;

  const { error } = await supabase.storage.from(params.bucket).upload(path, params.file, {
    contentType: params.contentType || (params.file instanceof File ? params.file.type : undefined),
    upsert: false,
  });

  if (error) throw new Error(describeUnknownError(error, 'Could not upload the file. Try again.'));

  const { data } = await supabase.storage.from(params.bucket).createSignedUrl(path, 60 * 60);
  return { bucket: params.bucket, path, signedUrl: data?.signedUrl };
}

export async function getSignedObjectUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('File storage is temporarily unavailable.');
  }

  const { data, error } = await getSupabaseClient()
    .storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw new Error(describeUnknownError(error, 'Could not open the file. Try again.'));
  if (!data?.signedUrl) throw new Error('Could not open the file. Try again.');
  return data.signedUrl;
}
