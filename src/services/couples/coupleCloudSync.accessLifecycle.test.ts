import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform', () => ({
  getPlatformProvider: vi.fn(() => 'supabase'),
}));
vi.mock('../backend/supabaseClient', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  getSupabaseClient: vi.fn(),
}));

import { getSupabaseClient } from '../backend/supabaseClient';
import {
  PortalAccessError,
  pullCouplePortalSnapshot,
  pullGuestPortalSnapshot,
} from './coupleCloudSync';

describe('portal snapshot access-lifecycle denials (Review #276 F-276-4)', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    vi.mocked(getSupabaseClient).mockReturnValue({ rpc } as never);
  });

  it.each(['expired', 'not_found', 'venue_unavailable', 'account_required'])(
    'preserves the authoritative couple denial %s',
    async (code) => {
      rpc.mockResolvedValue({ data: { ok: false, error: code }, error: null });

      await expect(pullCouplePortalSnapshot('couple-token-at-least-sixteen')).rejects.toMatchObject({
        name: 'PortalAccessError',
        code,
      });
    },
  );

  it.each(['expired', 'not_found', 'venue_unavailable', 'account_required'])(
    'preserves the authoritative guest denial %s',
    async (code) => {
      rpc.mockResolvedValue({ data: { ok: false, error: code }, error: null });

      await expect(
        pullGuestPortalSnapshot('couple-1', 'guest-token-at-least-sixteen'),
      ).rejects.toMatchObject({ name: 'PortalAccessError', code });
    },
  );

  it('keeps transport failures retryable instead of treating them as access revocation', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('offline') });

    await expect(pullCouplePortalSnapshot('couple-token-at-least-sixteen')).resolves.toBeNull();
    await expect(
      pullGuestPortalSnapshot('couple-1', 'guest-token-at-least-sixteen'),
    ).resolves.toBeNull();
  });

  it('does not expose an arbitrary server string as the denial code', async () => {
    rpc.mockResolvedValue({
      data: { ok: false, error: '<private backend detail>' },
      error: null,
    });

    await expect(pullCouplePortalSnapshot('couple-token-at-least-sixteen')).rejects.toEqual(
      expect.objectContaining<Partial<PortalAccessError>>({ code: 'access_denied' }),
    );
  });
});
