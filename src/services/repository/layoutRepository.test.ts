import { beforeEach, describe, expect, it, vi } from 'vitest';

// The repository reads the platform provider + supabase config from modules we
// mock so tests don't need a live project.
vi.mock('../platform', () => ({
  getPlatformProvider: () => 'local',
}));

vi.mock('../../hooks/useLayoutState', () => {
  let stored: any[] = [];
  return {
    getSavedLayouts: () => stored,
    setSavedLayouts: (l: any[]) => { stored = l; },
    getStoredDirectMessages: () => [],
  };
});

import { LocalLayoutRepository, getLayoutRepository } from './layoutRepository';

describe('LayoutRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the local provider when the platform is local', () => {
    const repo = getLayoutRepository();
    expect(repo.provider).toBe('local');
    expect(repo).toBeInstanceOf(LocalLayoutRepository);
  });

  it('saves and loads layouts through the local provider', async () => {
    const repo = new LocalLayoutRepository();
    const layouts = [
      { id: 'l1', name: 'Reception', venueId: 'v1', tables: [], fixtures: [], decor: [], guests: [] },
    ] as any;

    await repo.saveAll({ organizationId: 'org1', userId: 'u1' }, layouts);
    const loaded = await repo.loadAll({ organizationId: 'org1', userId: 'u1' });

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('l1');
  });
});
