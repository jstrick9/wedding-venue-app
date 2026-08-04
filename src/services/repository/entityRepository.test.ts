import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform', () => ({
  getPlatformProvider: () => 'supabase',
}));

const upsert = vi.fn();
const supabaseClient = {
  from: (table: string) => {
    if (table === 'org_data') {
      return {
        upsert: (row: any, opts?: any) => ({ error: upsert(row, opts) }),
        select: () => ({
          eq: () => ({ data: null, error: null }),
        }),
      };
    }
    return { select: () => ({ eq: () => ({}) }) };
  },
};
vi.mock('../backend/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => supabaseClient,
}));

// Provide backup-domains data: minimal read/write via localStorage.
vi.mock('../../utils/backupDomains', () => {
  const make = (key: string) => ({
    key,
    read: () => JSON.parse(localStorage.getItem(`test_${key}`) || '[]'),
    write: (v: unknown) => localStorage.setItem(`test_${key}`, JSON.stringify(v)),
  });
  return {
    BACKUP_DOMAINS: [
      make('venues'),
      make('tableSpecs'),
      make('decorItems'),
      make('vendors'),
      make('staffTasks'),
    ],
  };
});

import { SupabaseEntityRepository, isSyncableDomain } from './entityRepository';

describe('entityRepository (supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('isSyncableDomain recognizes the catalog/asset domains', () => {
    expect(isSyncableDomain('venues')).toBe(true);
    expect(isSyncableDomain('vendors')).toBe(true);
    expect(isSyncableDomain('config')).toBe(false); // config is not org-scoped syncable
  });

  it('pushDomain upserts the domain into org_data', async () => {
    localStorage.setItem('test_venues', JSON.stringify([{ id: 'v1' }]));
    const repo = new SupabaseEntityRepository();
    await repo.pushDomain({ organizationId: 'org1', userId: 'u1' }, 'venues');

    expect(upsert).toHaveBeenCalledWith(
      { organization_id: 'org1', domain: 'venues', payload: [{ id: 'v1' }] },
      { onConflict: 'organization_id,domain' },
    );
  });
});
