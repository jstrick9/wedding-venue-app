import { beforeEach, describe, expect, it, vi } from 'vitest';

// Force the platform to supabase for these tests.
vi.mock('../platform', () => ({
  getPlatformProvider: () => 'supabase',
}));

const saveAll = vi.fn();
const loadAll = vi.fn();

vi.mock('../repository/layoutRepository', () => ({
  getLayoutRepository: () => ({ provider: 'supabase', saveAll, loadAll }),
}));

let stored: any[] = [];
vi.mock('../../hooks/useLayoutState', () => ({
  getSavedLayouts: () => stored,
  setSavedLayouts: (l: any[]) => { stored = l; },
}));

import { canSyncLayouts, pullLayouts, pushLayouts } from './layoutSync';

const ctx = { organizationId: 'org1', userId: 'u1' };

describe('layoutSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stored = [];
  });

  it('canSyncLayouts is true only when an organization is known (supabase mode)', () => {
    expect(canSyncLayouts('org1')).toBe(true);
    expect(canSyncLayouts(null)).toBe(false);
    expect(canSyncLayouts(undefined)).toBe(false);
  });

  it('pullLayouts overwrites the local store with remote layouts when non-empty', async () => {
    loadAll.mockResolvedValue([
      { id: 'l1', name: 'Remote', venueId: 'v1', tables: [], fixtures: [], decor: [], guests: [] },
    ]);

    await pullLayouts(ctx);

    expect(loadAll).toHaveBeenCalledWith(ctx);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('l1');
  });

  it('pullLayouts replaces the local store with the remote result even when empty (P1-5)', async () => {
    // A server that correctly has zero layouts must clear stale local layouts so
    // the UI reflects the shared source of truth.
    loadAll.mockResolvedValue([]);
    stored = [{ id: 'local' }];

    await pullLayouts(ctx);

    expect(loadAll).toHaveBeenCalledWith(ctx);
    expect(stored).toHaveLength(0);
  });

  it('pushLayouts sends the current local layouts to the backend', async () => {
    stored = [{ id: 'l1', name: 'A' }];

    await pushLayouts(ctx);

    expect(saveAll).toHaveBeenCalledWith(ctx, stored);
  });
});
