import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  captureDomain: vi.fn((domain: string) => ({ found: true, payload: { domain } })),
  getRevision: vi.fn(() => undefined),
  pushDomain: vi.fn(),
  saveVenueMap: vi.fn(),
  syncSnapshots: vi.fn(),
  syncProjection: vi.fn(),
}));

vi.mock('../platform', () => ({ getPlatformProvider: () => 'supabase' }));
vi.mock('../repository/entityRepository', () => ({
  captureEntityDomainPayload: mocks.captureDomain,
  getEntityDomainRevision: mocks.getRevision,
  getEntityRepository: () => ({
    provider: 'supabase',
    pushDomain: mocks.pushDomain,
    saveVenueMap: mocks.saveVenueMap,
    pushAll: vi.fn(),
    pullAll: vi.fn(),
  }),
}));
vi.mock('../couples/coupleCloudSync', () => ({
  affectsCouplePortalSnapshots: (domain: string) =>
    domain === 'venueMapConfigs' || domain === 'coupleEvents' || domain === 'all',
  pullAllCouplePortalSnapshotsForVenue: vi.fn(),
  syncAllCouplePortalSnapshots: mocks.syncSnapshots,
}));
vi.mock('../couples/coupleProjection', () => ({
  syncCoupleRelationalProjection: mocks.syncProjection,
}));
vi.mock('../../utils/appEvents', () => ({ emitDataChanged: vi.fn() }));

import { pushEntityDomain, saveVenueMapEntity } from './entitySync';

const context = { organizationId: 'org-1', userId: 'user-1' };

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('pushEntityDomain portal publication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveVenueMap.mockResolvedValue({
      status: 'saved',
      updatedAt: '2026-09-06T12:05:00.000Z',
    });
  });

  it('refreshes portal snapshots when the venue map changes', async () => {
    await pushEntityDomain(context, 'venueMapConfigs');

    expect(mocks.pushDomain).toHaveBeenCalledWith(
      context,
      'venueMapConfigs',
      { found: true, payload: { domain: 'venueMapConfigs' }, expectedUpdatedAt: undefined },
    );
    expect(mocks.syncSnapshots).toHaveBeenCalledWith(
      context,
      { venueMapConfig: { domain: 'venueMapConfigs' } },
    );
    expect(mocks.syncProjection).not.toHaveBeenCalled();
  });

  it('does not refresh portal snapshots for an unrelated staff domain', async () => {
    await pushEntityDomain(context, 'staffTasks');
    expect(mocks.syncSnapshots).not.toHaveBeenCalled();
  });

  it('serializes writes for the same organization and domain', async () => {
    const firstRequest = deferred<void>();
    mocks.captureDomain
      .mockReturnValueOnce({ found: true, payload: { domain: 'map-v1' } })
      .mockReturnValueOnce({ found: true, payload: { domain: 'map-v2' } });
    mocks.pushDomain
      .mockImplementationOnce(() => firstRequest.promise)
      .mockResolvedValueOnce(undefined);

    const firstPush = pushEntityDomain(context, 'venueMapConfigs');
    await vi.waitFor(() => expect(mocks.pushDomain).toHaveBeenCalledTimes(1));

    const secondPush = pushEntityDomain(context, 'venueMapConfigs');
    await Promise.resolve();
    expect(mocks.pushDomain).toHaveBeenCalledTimes(1);

    firstRequest.resolve();
    await firstPush;
    await vi.waitFor(() => expect(mocks.pushDomain).toHaveBeenCalledTimes(2));
    await secondPush;

    expect(mocks.pushDomain).toHaveBeenNthCalledWith(
      1,
      context,
      'venueMapConfigs',
      { found: true, payload: { domain: 'map-v1' }, expectedUpdatedAt: undefined },
    );
    expect(mocks.pushDomain).toHaveBeenNthCalledWith(
      2,
      context,
      'venueMapConfigs',
      { found: true, payload: { domain: 'map-v2' }, expectedUpdatedAt: undefined },
    );
    expect(mocks.syncSnapshots).toHaveBeenNthCalledWith(
      1,
      context,
      { venueMapConfig: { domain: 'map-v1' } },
    );
    expect(mocks.syncSnapshots).toHaveBeenNthCalledWith(
      2,
      context,
      { venueMapConfig: { domain: 'map-v2' } },
    );
  });

  it('does not let a rejected write permanently block its domain queue', async () => {
    mocks.pushDomain
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce(undefined);

    await expect(pushEntityDomain(context, 'venueMapConfigs')).rejects.toThrow(
      'temporary network failure',
    );
    await expect(pushEntityDomain(context, 'venueMapConfigs')).resolves.toBeUndefined();
    expect(mocks.pushDomain).toHaveBeenCalledTimes(2);
  });

  it('publishes snapshots only after a revision-guarded map save succeeds', async () => {
    const draft = { points: [{ id: 'draft' }] };
    await expect(saveVenueMapEntity(
      context,
      draft,
      '2026-09-06T12:00:00.000Z',
    )).resolves.toEqual({
      status: 'saved',
      updatedAt: '2026-09-06T12:05:00.000Z',
    });

    expect(mocks.saveVenueMap).toHaveBeenCalledWith(
      context,
      draft,
      '2026-09-06T12:00:00.000Z',
      false,
    );
    expect(mocks.syncSnapshots).toHaveBeenCalledWith(
      context,
      { venueMapConfig: draft },
    );
  });

  it('returns a map conflict without publishing the rejected draft', async () => {
    mocks.saveVenueMap.mockResolvedValueOnce({
      status: 'conflict',
      currentPayload: { points: [{ id: 'server' }] },
      currentUpdatedAt: '2026-09-06T12:10:00.000Z',
    });

    await expect(saveVenueMapEntity(
      context,
      { points: [{ id: 'draft' }] },
      '2026-09-06T12:00:00.000Z',
    )).resolves.toEqual(expect.objectContaining({ status: 'conflict' }));
    expect(mocks.syncSnapshots).not.toHaveBeenCalled();
  });
});
