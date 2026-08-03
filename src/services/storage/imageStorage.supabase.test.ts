import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform', () => ({
  getPlatformProvider: () => 'supabase',
}));

const upload = vi.fn();
const signedUrl = vi.fn();
vi.mock('./ObjectStorageService', () => ({
  uploadObject: (params: any) => upload(params),
  getSignedObjectUrl: (bucket: string, path: string) => signedUrl(bucket, path),
}));

import { resolveImageRef, uploadImage } from './imageStorage';

describe('imageStorage (supabase provider)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploadImage uploads to the bucket and returns a storage path ref', async () => {
    upload.mockResolvedValue({ bucket: 'venue-images', path: 'org1/photo.png' });
    const file = new File(['x'], 'photo.png', { type: 'image/png' });

    const ref = await uploadImage(file, { bucket: 'venue-images', organizationId: 'org1' });

    expect(ref).toBe('sp://venue-images/org1/photo.png');
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({
      bucket: 'venue-images',
      organizationId: 'org1',
    }));
  });

  it('resolveImageRef resolves a storage path to a signed URL', async () => {
    signedUrl.mockResolvedValue('https://signed/url');
    const url = await resolveImageRef('sp://venue-images/org1/photo.png');
    expect(url).toBe('https://signed/url');
    expect(signedUrl).toHaveBeenCalledWith('venue-images', 'org1/photo.png');
  });

  it('resolveImageRef passes data URLs through unchanged', async () => {
    const url = await resolveImageRef('data:image/png;base64,abc');
    expect(url).toBe('data:image/png;base64,abc');
    expect(signedUrl).not.toHaveBeenCalled();
  });
});
