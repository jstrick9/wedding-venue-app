import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pushDomain: vi.fn(),
  syncSnapshots: vi.fn(),
  syncProjection: vi.fn(),
}));

vi.mock('../platform', () => ({ getPlatformProvider: () => 'supabase' }));
vi.mock('../repository/entityRepository', () => ({
  getEntityRepository: () => ({
    provider: 'supabase',
    pushDomain: mocks.pushDomain,
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

import { pushEntityDomain } from './entitySync';

const context = { organizationId: 'org-1', userId: 'user-1' };

describe('pushEntityDomain portal publication', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refreshes portal snapshots when the venue map changes', async () => {
    await pushEntityDomain(context, 'venueMapConfigs');

    expect(mocks.pushDomain).toHaveBeenCalledWith(context, 'venueMapConfigs');
    expect(mocks.syncSnapshots).toHaveBeenCalledWith(context);
    expect(mocks.syncProjection).not.toHaveBeenCalled();
  });

  it('does not refresh portal snapshots for an unrelated staff domain', async () => {
    await pushEntityDomain(context, 'staffTasks');
    expect(mocks.syncSnapshots).not.toHaveBeenCalled();
  });
});
