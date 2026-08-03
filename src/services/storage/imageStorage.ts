import { getPlatformProvider } from '../platform';
import {
  getSignedObjectUrl,
  uploadObject,
  type StorageBucket,
} from './ObjectStorageService';

/**
 * Image storage seam.
 *
 * The app stores images differently depending on the platform:
 *  - `local`    → images are kept as data URLs in the existing localStorage
 *    model (current behavior; works offline with zero setup).
 *  - `supabase` → images are uploaded to a private bucket and a **path
 *    reference** is stored (not the raw data). Paths are later resolved to
 *    short-lived signed URLs for display, so storage stays private and
 *    localStorage stays small.
 *
 * Images in the UI are either:
 *  - data URLs (local mode), or
 *  - storage path references like `sp://<bucket>/<path>` (supabase mode).
 */
export type ImageRef = string; // data URL or `sp://bucket/path`

export interface UploadImageOptions {
  bucket: StorageBucket;
  organizationId?: string;
  eventId?: string;
  userId?: string;
}

export function isImageRef(ref: ImageRef | undefined | null): ref is string {
  return typeof ref === 'string' && ref.length > 0;
}

export function isStoragePathRef(ref: string): boolean {
  return ref.startsWith('sp://');
}

export async function uploadImage(
  file: File,
  options: UploadImageOptions,
): Promise<ImageRef> {
  const provider = getPlatformProvider();

  if (provider === 'supabase') {
    const { uploadObject } = await import('./ObjectStorageService');
    const result = await uploadObject({
      bucket: options.bucket,
      file,
      organizationId: options.organizationId,
      eventId: options.eventId,
      userId: options.userId,
    });
    return `sp://${result.bucket}/${result.path}`;
  }

  // Local mode: keep a data URL (current behavior).
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Resolve an image reference to something the <img> tag can load.
 *  - data URLs pass through unchanged.
 *  - storage path refs are resolved to a signed URL in Supabase mode.
 */
export async function resolveImageRef(ref: ImageRef): Promise<string> {
  if (!isStoragePathRef(ref)) return ref;
  const provider = getPlatformProvider();
  if (provider !== 'supabase') return '';

  const rest = ref.slice('sp://'.length);
  const bucket = rest.split('/')[0] as StorageBucket;
  const path = rest.slice(bucket.length + 1);
  return getSignedObjectUrl(bucket, path);
}
