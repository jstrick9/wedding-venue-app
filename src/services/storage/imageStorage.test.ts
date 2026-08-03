import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform', () => ({
  getPlatformProvider: () => 'local',
}));

import { isImageRef, isStoragePathRef, uploadImage } from './imageStorage';

describe('imageStorage (local provider)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a data URL for local mode', async () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const ref = await uploadImage(file, { bucket: 'venue-images' });
    expect(ref.startsWith('data:')).toBe(true);
  });

  it('isStoragePathRef / isImageRef helpers work', () => {
    expect(isStoragePathRef('sp://venue-images/org1/photo.png')).toBe(true);
    expect(isStoragePathRef('data:image/png;base64,abc')).toBe(false);
    expect(isImageRef('abc')).toBe(true);
    expect(isImageRef(undefined)).toBe(false);
  });
});
