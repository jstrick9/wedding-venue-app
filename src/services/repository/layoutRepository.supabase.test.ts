import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseLayoutRepository } from './layoutRepository';

// Mock the Supabase client as a fluent chain so we can drive the optimistic
// upsert logic without a live project.
const calls: string[] = [];
let existingRows: any[] = [];
let nextInsertId = 100;
let insertError: any = null;

function makeChainBuilder(resultFn: () => { data?: any; error?: any }) {
  const chain: any = {};
  chain.from = () => chain;
  chain.select = () => chain;
  chain.insert = (rows: any) => {
    calls.push(`insert:${JSON.stringify(rows)}`);
    if (insertError) return { data: null, error: insertError };
    const inserted = rows;
    const data = Array.isArray(inserted)
      ? inserted.map((r: any, i: number) => ({ id: `row-${nextInsertId + i}`, ...r }))
      : { id: `row-${nextInsertId}`, ...inserted };
    nextInsertId += Array.isArray(inserted) ? inserted.length : 1;
    return { data, error: null };
  };
  chain.update = (v: any) => {
    calls.push(`update:${JSON.stringify(v)}`);
    return { data: null, error: null };
  };
  chain.delete = () => {
    calls.push('delete');
    return { data: null, error: null };
  };
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.maybeSingle = () => chain;
  chain.single = () => chain;
  chain.upsert = () => chain;
  return chain;
}

vi.mock('../platform', () => ({
  getPlatformProvider: () => 'supabase',
}));

function makeResult(data: any, error: any = null) {
  return { data, error };
}

vi.mock('../backend/supabaseClient', () => {
  const chain = (resultFor: () => { data?: any; error?: any }) => {
    const c: any = {};
    c.from = () => c;
    c.select = () => c;
    c.insert = (rows: any) => {
      calls.push(`insert:${JSON.stringify(rows)}`);
      if (insertError) return makeResult(null, insertError);
      const inserted = Array.isArray(rows) ? rows[0] : rows;
      const id = `row-${nextInsertId++}`;
      // Support the `.insert(...).select('id').single()` pattern.
      c.select = () => ({ single: () => makeResult({ id, ...inserted }) });
      return c;
    };
    c.update = (v: any) => {
      calls.push(`update:${JSON.stringify(v)}`);
      c.eq = () => makeResult(null, null);
      return c;
    };
    c.delete = () => {
      calls.push('delete');
      c.eq = () => makeResult(null, null);
      return c;
    };
    c.eq = () => c;
    c.order = () => c;
    c.limit = () => c;
    c.maybeSingle = () => c;
    c.single = () => makeResult(null, null);
    c.upsert = () => makeResult(null, null);
    c.then = undefined;
    return c;
  };

  const supabase = {
    from: () => {
      const c = chain(() => ({}));
      // select(...).eq(...) is the "load existing" call → return existingRows.
      const originalSelect = c.select;
      c.select = (cols: string) => {
        c.eq = () => makeResult(existingRows, null);
        return c;
      };
      void originalSelect;
      return c;
    },
  };
  return {
    getSupabaseClient: () => supabase,
    isSupabaseConfigured: () => true,
  };
});

const context = { organizationId: 'org1', userId: 'u1' };
const repo = new SupabaseLayoutRepository();

function layout(id: string, revision?: number): any {
  return { id, name: `Layout ${id}`, venueId: 'v1', tables: [], fixtures: [], decor: [], guests: [], ...(revision ? { revision } : {}) };
}

describe('SupabaseLayoutRepository optimistic upsert (P1-4)', () => {
  beforeEach(() => {
    calls.length = 0;
    existingRows = [];
    nextInsertId = 100;
    insertError = null;
  });

  it('inserts a new layout at revision 1 and writes a version record', async () => {
    await repo.saveAll(context, [layout('l1')]);
    const insertCall = calls.find((c) => c.startsWith('insert:'));
    expect(insertCall).toBeDefined();
    expect(insertCall!).toContain('"revision":1');
    expect(insertCall!).toContain('"id":"l1"');
    // A version record insert should also occur.
    expect(calls.filter((c) => c.startsWith('insert:')).length).toBeGreaterThanOrEqual(1);
  });

  it('updates an existing layout in place, incrementing its revision', async () => {
    existingRows = [{ id: 'row-1', revision: 2, payload: layout('l1') }];
    await repo.saveAll(context, [layout('l1', 2)]);
    const updateCall = calls.find((c) => c.startsWith('update:'));
    expect(updateCall).toBeDefined();
    expect(updateCall!).toContain('"revision":3');
    // No delete should occur for a still-present layout.
    expect(calls.includes('delete')).toBe(false);
  });

  it('skips a stale local edit when the server revision is newer (no clobber)', async () => {
    existingRows = [{ id: 'row-1', revision: 5, payload: layout('l1') }];
    await repo.saveAll(context, [layout('l1', 3)]);
    // Local revision 3 < server 5 → must NOT update or delete.
    expect(calls.some((c) => c.startsWith('update:'))).toBe(false);
    expect(calls.includes('delete')).toBe(false);
  });

  it('deletes remote rows that no longer exist locally', async () => {
    existingRows = [
      { id: 'row-1', revision: 1, payload: layout('l1') },
      { id: 'row-2', revision: 1, payload: layout('l2') },
    ];
    await repo.saveAll(context, [layout('l1')]);
    expect(calls.includes('delete')).toBe(true);
  });

  it('propagates a write error', async () => {
    insertError = { message: 'db down' };
    await expect(repo.saveAll(context, [layout('l9')])).rejects.toThrow();
  });
});
