import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform', () => ({
  getPlatformProvider: () => 'supabase',
}));

const upsert = vi.fn();
const rpc = vi.fn();
let selectedRows: Array<{ domain: string; payload: unknown; updated_at?: string }> | null = null;
const supabaseClient = {
  rpc,
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
      make('venueMapStructuralRecovery', null),
    ],
  };
});

import { on } from '../../utils/appEvents';
import {
  captureEntityDomainPayload,
  getEntityDomainRevision,
  SupabaseEntityRepository,
  isSyncableDomain,
} from './entityRepository';
import {
  cacheVenueMapConfigFromServer,
  emptyVenueMapConfig,
} from '../wayfinding/venueWayfindingService';

describe('entityRepository (supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({
      data: { ok: true, updated_at: '2026-09-06T12:05:00.000Z' },
      error: null,
    });
    localStorage.clear();
    selectedRows = null;
  });

  it('isSyncableDomain recognizes the catalog/asset domains', () => {
    expect(isSyncableDomain('venues')).toBe(true);
    expect(isSyncableDomain('vendors')).toBe(true);
    expect(isSyncableDomain('venueMapStructuralRecovery')).toBe(false);
    expect(isSyncableDomain('config')).toBe(false); // config is not org-scoped syncable
  });

  it('blocks generic map capture while structural recovery decisions are pending', () => {
    cacheVenueMapConfigFromServer({
      ...emptyVenueMapConfig(),
      points: [{ label: 'Missing identity', kind: 'entry', x: 1, y: 1 }],
    });

    expect(() => captureEntityDomainPayload('venueMapConfigs')).toThrow(/explicitly reconstructed or removed/i);

    cacheVenueMapConfigFromServer(emptyVenueMapConfig());
    expect(() => captureEntityDomainPayload('venueMapConfigs')).not.toThrow();
  });

  it('blocks a direct generic map push while structural recovery is pending', async () => {
    cacheVenueMapConfigFromServer({
      ...emptyVenueMapConfig(),
      points: [{ label: 'Missing identity', kind: 'entry', x: 1, y: 1 }],
    });
    const repo = new SupabaseEntityRepository();

    await expect(repo.pushDomain(
      { organizationId: 'org1', userId: 'u1' },
      'venueMapConfigs',
    )).rejects.toThrow(/explicitly reconstructed or removed/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('blocks a direct canonical map save with an explicit invalid route priority', async () => {
    const repo = new SupabaseEntityRepository();
    const payload = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'gate', label: 'Gate', kind: 'entry', x: 5, y: 5 },
        { id: 'lawn', label: 'Lawn', kind: 'space', x: 50, y: 40 },
      ],
      routes: [{
        id: 'unsafe',
        name: 'Unsafe route',
        pointIds: ['gate', 'lawn'],
        priority: 'emergency',
      }],
    };

    localStorage.setItem('test_venueMapConfigs', JSON.stringify(payload));
    expect(() => captureEntityDomainPayload('venueMapConfigs'))
      .toThrow(/Invalid walkway priorities/i);

    await expect(repo.saveVenueMap(
      { organizationId: 'org1', userId: 'u1' },
      payload,
      null,
    )).rejects.toThrow(/Invalid walkway priorities/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('blocks generic capture and direct canonical saves with an explicit invalid map frame', async () => {
    const repo = new SupabaseEntityRepository();
    const payload = {
      ...emptyVenueMapConfig(),
      width: '100',
    };

    localStorage.setItem('test_venueMapConfigs', JSON.stringify(payload));
    expect(() => captureEntityDomainPayload('venueMapConfigs'))
      .toThrow(/Invalid map width or height/i);

    await expect(repo.saveVenueMap(
      { organizationId: 'org1', userId: 'u1' },
      payload,
      null,
    )).rejects.toThrow(/Invalid map width or height/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('blocks generic capture and direct canonical saves that exceed the Venue Map budget', async () => {
    const repo = new SupabaseEntityRepository();
    const payload = {
      ...emptyVenueMapConfig(),
      points: Array.from({ length: 501 }, (_, index) => ({
        id: `point-${index}`,
        label: `Point ${index}`,
        kind: 'entry' as const,
        x: index % 100,
        y: index % 80,
      })),
    };

    localStorage.setItem('test_venueMapConfigs', JSON.stringify(payload));
    expect(() => captureEntityDomainPayload('venueMapConfigs'))
      .toThrow(/oversized Venue Map|complexity budget/i);

    await expect(repo.saveVenueMap(
      { organizationId: 'org1', userId: 'u1' },
      payload,
      null,
    )).rejects.toThrow(/complexity budget/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('blocks generic capture and direct canonical saves with out-of-frame points', async () => {
    const repo = new SupabaseEntityRepository();
    const payload = {
      ...emptyVenueMapConfig(),
      points: [{ id: 'outside', label: 'Wrong gate', kind: 'entry', x: 101, y: 20 }],
    };

    localStorage.setItem('test_venueMapConfigs', JSON.stringify(payload));
    expect(() => captureEntityDomainPayload('venueMapConfigs'))
      .toThrow(/out-of-frame map-point coordinates/i);

    await expect(repo.saveVenueMap(
      { organizationId: 'org1', userId: 'u1' },
      payload,
      null,
    )).rejects.toThrow(/out-of-frame map-point coordinates/i);
    expect(rpc).not.toHaveBeenCalled();
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

  it('saves the venue map against the revision observed during hydration', async () => {
    selectedRows = [{
      domain: 'venueMapConfigs',
      payload: { points: [] },
      updated_at: '2026-09-06T12:00:00.000Z',
    }];
    const repo = new SupabaseEntityRepository();
    const context = { organizationId: 'org-map-existing', userId: 'u1' };
    const nextMap = {
      ...emptyVenueMapConfig(),
      points: [{ id: 'new', label: 'New point', kind: 'entry', x: 5, y: 5 }],
    };
    await repo.pullAll(context);

    expect(getEntityDomainRevision(context.organizationId, 'venueMapConfigs'))
      .toBe('2026-09-06T12:00:00.000Z');
    await expect(repo.saveVenueMap(
      context,
      nextMap,
      getEntityDomainRevision(context.organizationId, 'venueMapConfigs'),
    )).resolves.toEqual({
      status: 'saved',
      updatedAt: '2026-09-06T12:05:00.000Z',
    });

    expect(rpc).toHaveBeenCalledWith('save_venue_map_config', {
      p_organization_id: 'org-map-existing',
      p_payload: nextMap,
      p_expected_updated_at: '2026-09-06T12:00:00.000Z',
      p_expected_missing: false,
      p_force: false,
    });
  });

  it('represents an observed missing map row separately from an unknown revision', async () => {
    const repo = new SupabaseEntityRepository();
    const context = { organizationId: 'org-map-missing', userId: 'u1' };
    await repo.pullAll(context);
    expect(getEntityDomainRevision(context.organizationId, 'venueMapConfigs')).toBeNull();

    await repo.saveVenueMap(context, { points: [] }, null);
    expect(rpc).toHaveBeenCalledWith(
      'save_venue_map_config',
      expect.objectContaining({
        p_expected_updated_at: null,
        p_expected_missing: true,
      }),
    );
  });

  it('returns the current server map without overwriting it on a revision conflict', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        ok: false,
        error: 'conflict',
        current_payload: { points: [{ id: 'server' }] },
        current_updated_at: '2026-09-06T12:10:00.000Z',
      },
      error: null,
    });
    const repo = new SupabaseEntityRepository();
    const draftMap = {
      ...emptyVenueMapConfig(),
      points: [{ id: 'draft', label: 'Draft point', kind: 'entry', x: 5, y: 5 }],
    };
    await expect(repo.saveVenueMap(
      { organizationId: 'org-map-conflict', userId: 'u1' },
      draftMap,
      '2026-09-06T12:00:00.000Z',
    )).resolves.toEqual({
      status: 'conflict',
      currentPayload: { points: [{ id: 'server' }] },
      currentUpdatedAt: '2026-09-06T12:10:00.000Z',
    });
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
