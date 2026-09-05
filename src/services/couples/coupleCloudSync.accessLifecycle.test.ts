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
  pullAllCouplePortalSnapshotsForVenue,
  pullCouplePortalSnapshot,
  pullGuestPortalSnapshot,
} from './coupleCloudSync';
import {
  getVenueMapConfig,
  saveVenueMapConfig,
} from '../wayfinding/venueWayfindingService';

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

  it('hydrates only the server-provided guest venue-map field', async () => {
    const guestMap = {
      width: 100,
      height: 80,
      points: [{ id: 'public-entry', label: 'Guest Entrance', kind: 'entry', x: 10, y: 10 }],
      routes: [],
      rainContingencies: [],
      drawings: [],
      updatedAt: '2026-09-05T00:00:00.000Z',
    };
    rpc.mockResolvedValue({
      data: {
        ok: true,
        event: [],
        venue_map: guestMap,
        // An unexpected broader implementation field must not be selected by
        // the cloud parser even if a server regression accidentally adds one.
        venueMapConfigs: { ...guestMap, points: [{ id: 'staff-only' }] },
      },
      error: null,
    });

    const snapshot = await pullGuestPortalSnapshot(
      'couple-1',
      'guest-token-at-least-sixteen',
    );

    expect(snapshot?.venueMap).toEqual(guestMap);
    expect(snapshot).not.toHaveProperty('venueMapConfigs');
  });

  it('does not overwrite canonical venue globals with a couple-filtered bulk snapshot', async () => {
    localStorage.clear();
    saveVenueMapConfig({
      width: 100,
      height: 80,
      points: [{ id: 'staff-yard', label: 'Service Yard', kind: 'amenity', x: 10, y: 10, audience: 'staff' }],
      routes: [],
      drawings: [],
      rainContingencies: [],
      updatedAt: '2026-09-05T12:00:00.000Z',
    });
    const eq = vi.fn().mockResolvedValue({
      data: [{
        couple_id: 'couple-1',
        payload: {
          venueMapConfigs: {
            width: 100,
            height: 80,
            points: [{ id: 'guest-gate', label: 'Guest Gate', kind: 'entry', x: 5, y: 5 }],
            routes: [],
            drawings: [],
            rainContingencies: [],
          },
        },
      }],
      error: null,
    });
    vi.mocked(getSupabaseClient).mockReturnValue({
      rpc,
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })),
    } as never);

    await expect(pullAllCouplePortalSnapshotsForVenue({
      organizationId: 'org-1',
      userId: 'user-1',
    })).resolves.toBe(true);

    expect(getVenueMapConfig()?.points.map((point) => point.id)).toEqual(['staff-yard']);
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
