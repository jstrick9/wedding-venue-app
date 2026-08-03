import { getPlatformProvider, type PlatformProvider } from '../platform';
import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import type { SavedLayout } from '../../hooks/useLayoutState';
import { getSavedLayouts, setSavedLayouts } from '../../hooks/useLayoutState';

/**
 * Layout persistence abstraction.
 *
 * The UI always holds layouts in-memory (via useLayoutState). This repository
 * decides where those layouts are persisted/read from:
 *  - `local`    → localStorage (default, offline, zero-setup).
 *  - `supabase` → the `layouts` table (RLS-scoped, multi-device), keyed by the
 *    current organization. Layout data is stored in the jsonb `payload` column.
 *
 * It is intentionally a thin seam so the rest of the app can adopt a shared
 * backend without rewriting every storage call at once.
 */

export interface LayoutSyncContext {
  organizationId: string;
  userId: string;
}

export interface LayoutRepository {
  provider: PlatformProvider;
  /** Persist all layouts for a context. */
  saveAll(context: LayoutSyncContext, layouts: SavedLayout[]): Promise<void>;
  /** Read all layouts for a context. */
  loadAll(context: LayoutSyncContext): Promise<SavedLayout[]>;
}

/** Local provider — persists to the existing localStorage store. */
export class LocalLayoutRepository implements LayoutRepository {
  provider: PlatformProvider = 'local';

  async saveAll(_context: LayoutSyncContext, layouts: SavedLayout[]): Promise<void> {
    setSavedLayouts(layouts);
  }

  async loadAll(_context: LayoutSyncContext): Promise<SavedLayout[]> {
    return getSavedLayouts();
  }
}

/** Supabase provider — RLS-scoped layouts in the `layouts` table. */
export class SupabaseLayoutRepository implements LayoutRepository {
  provider: PlatformProvider = 'supabase';

  async saveAll(context: LayoutSyncContext, layouts: SavedLayout[]): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
    const supabase = getSupabaseClient();

    // Replace-sync: the app's in-memory layout list is the source of truth, so
    // we remove the org's existing rows and insert the current set. This avoids
    // depending on a natural unique key in the schema and is simple/correct.
    const { error: delErr } = await supabase
      .from('layouts')
      .delete()
      .eq('organization_id', context.organizationId);
    if (delErr) throw delErr;

    if (layouts.length === 0) return;

    const rows = layouts.map((layout) => ({
      organization_id: context.organizationId,
      name: layout.name,
      visibility: 'event',
      revision: 1,
      payload: layout,
      updated_by: context.userId,
    }));
    const { error: insErr } = await supabase.from('layouts').insert(rows);
    if (insErr) throw insErr;
  }

  async loadAll(context: LayoutSyncContext): Promise<SavedLayout[]> {
    if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('layouts')
      .select('payload')
      .eq('organization_id', context.organizationId);
    if (error) throw error;

    return (data || [])
      .map((row) => row.payload as SavedLayout)
      .filter((l): l is SavedLayout => Boolean(l && l.id));
  }
}

export function getLayoutRepository(): LayoutRepository {
  return getPlatformProvider() === 'supabase'
    ? new SupabaseLayoutRepository()
    : new LocalLayoutRepository();
}
