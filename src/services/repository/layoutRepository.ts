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

  /**
   * Save the organization's layouts using per-row optimistic upserts instead of
   * the previous destructive delete-all + reinsert (P1-4).
   *
   * Correlation: each `layouts` row's `payload.id` is the SavedLayout.id, so a
   * layout keeps the same DB row across saves. The DB `revision` is the source
   * of truth for versioning:
   *  - New layout  → insert with revision 1 and a layout_versions record.
   *  - Existing    → if the remote revision is NEWER than the local layout's
   *    stored revision, the remote change wins (stale local edit is skipped,
   *    not overwritten); otherwise update in place with revision+1 and append a
   *    layout_versions record.
   *  - Rows that no longer exist locally are removed (they are not referenced
   *    by the current client's workspace).
   */
  async saveAll(context: LayoutSyncContext, layouts: SavedLayout[]): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
    const supabase = getSupabaseClient();

    // Load existing rows so we can upsert by correlation and detect conflicts.
    const { data: existing, error: loadErr } = await supabase
      .from('layouts')
      .select('id,payload,revision,updated_at')
      .eq('organization_id', context.organizationId);
    if (loadErr) throw loadErr;

    const remoteById = new Map<string, { rowId: string; revision: number }>();
    for (const row of existing || []) {
      const layoutId = (row.payload as SavedLayout | null)?.id;
      if (layoutId) {
        remoteById.set(layoutId, { rowId: row.id, revision: row.revision });
      }
    }

    const localIds = new Set(layouts.map((l) => l.id));
    const toDelete: string[] = [];
    for (const [layoutId, remote] of remoteById) {
      if (!localIds.has(layoutId)) toDelete.push(remote.rowId);
    }

    // 1) Remove rows that no longer exist locally.
    for (const rowId of toDelete) {
      const { error } = await supabase.from('layouts').delete().eq('id', rowId);
      if (error) throw error;
    }

    // 2) Insert or update each layout with optimistic revision handling.
    for (const layout of layouts) {
      const remote = remoteById.get(layout.id);

      if (!remote) {
        // Brand-new layout: insert with revision 1 and a version record.
        const { data, error } = await supabase
          .from('layouts')
          .insert({
            organization_id: context.organizationId,
            name: layout.name,
            visibility: 'event',
            revision: 1,
            payload: layout,
            updated_by: context.userId,
          })
          .select('id')
          .single();
        if (error) throw error;
        if (data) {
          const { error: versionErr } = await supabase.from('layout_versions').insert({
            layout_id: data.id,
            revision: 1,
            payload: layout,
            created_by: context.userId,
          });
          if (versionErr) throw versionErr;
        }
        continue;
      }

      // Optimistic concurrency: if the local layout carries a revision and it is
      // older than the server's revision, a concurrent edit won — skip this
      // overwrite so we never clobber a newer remote version.
      const localRevision = (layout as SavedLayout & { revision?: number }).revision;
      if (typeof localRevision === 'number' && localRevision < remote.revision) {
        continue;
      }

      const nextRevision = remote.revision + 1;
      const { error: updErr } = await supabase
        .from('layouts')
        .update({
          name: layout.name,
          revision: nextRevision,
          payload: layout,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', remote.rowId);
      if (updErr) throw updErr;
      const { error: versionErr } = await supabase.from('layout_versions').insert({
        layout_id: remote.rowId,
        revision: nextRevision,
        payload: layout,
        created_by: context.userId,
      });
      if (versionErr) throw versionErr;
    }
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
