import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform', () => ({
  getPlatformProvider: () => 'supabase',
}));

const upsert = vi.fn();
let selectedRows: Array<{ domain: string; payload: unknown }> | null = null;
const supabaseClient = {
  from: (table: string) => {
    if (table === 'org_data') {
      return {
        upsert: (row: any, opts?: any) => ({ error: upsert(row, opts) }),
        select: () => ({
          eq: () => ({ data: selectedRows, error: null }),
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
  const make = (key: string, defaultValue: unknown = []) => ({
    key,
    storageKey: `test_${key}`,
    defaultValue,
    read: () => JSON.parse(localStorage.getItem(`test_${key}`) || JSON.stringify(defaultValue)),
    write: (v: unknown) => localStorage.setItem(`test_${key}`, JSON.stringify(v)),
  });
  return {
    BACKUP_DOMAINS: [
      make('venues'),
      make('tableSpecs'),
      make('decorItems'),
      make('vendors'),
      make('staffTasks'),
      make('venueMapConfigs', null),
    ],
  };
});

import { on } from '../../utils/appEvents';
import { SupabaseEntityRepository, isSyncableDomain } from './entityRepository';

describe('entityRepository (supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    selectedRows = null;
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

  it('does not mutate the shared cache when a tenant pull was superseded', async () => {
    localStorage.setItem('test_venues', JSON.stringify([{ id: 'active-venue' }]));
    selectedRows = [{ domain: 'venues', payload: [{ id: 'stale-venue' }] }];

    const repo = new SupabaseEntityRepository();
    const applied = await repo.pullAll(
      { organizationId: 'stale-org', userId: 'stale-user' },
      () => false,
    );

    expect(applied).toBe(false);
    expect(JSON.parse(localStorage.getItem('test_venues') || 'null')).toEqual([
      { id: 'active-venue' },
    ]);
  });

  it('marks pull notifications as backend-originated to prevent pull-push loops', async () => {
    selectedRows = [{ domain: 'venues', payload: [{ id: 'venue-b' }] }];
    const details: unknown[] = [];
    const off = on('spm_data_changed', (detail) => details.push(detail));

    const repo = new SupabaseEntityRepository();
    await repo.pullAll({ organizationId: 'org-b', userId: 'user-b' });
    off();

    expect(details.length).toBeGreaterThan(1);
    expect(details.every((detail) =>
      (detail as { source?: string } | undefined)?.source === 'backend')).toBe(true);
  });

  it('clears domains missing from a new organization instead of retaining another tenant cache', async () => {
    localStorage.setItem('test_venues', JSON.stringify([{ id: 'venue-a' }]));
    localStorage.setItem(
      'test_venueMapConfigs',
      JSON.stringify({ points: [{ id: 'private-map-a' }] }),
    );
    selectedRows = [{ domain: 'venues', payload: [{ id: 'venue-b' }] }];

    const repo = new SupabaseEntityRepository();
    await repo.pullAll({ organizationId: 'org-b', userId: 'user-b' });

    expect(JSON.parse(localStorage.getItem('test_venues') || 'null')).toEqual([
      { id: 'venue-b' },
    ]);
    expect(JSON.parse(localStorage.getItem('test_venueMapConfigs') || 'false')).toBeNull();
  });
});
