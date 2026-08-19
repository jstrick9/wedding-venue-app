import { getPlatformProvider } from '../platform';
import { getLayoutRepository, type LayoutSyncContext } from '../repository/layoutRepository';

export type { LayoutSyncContext };
import { getSavedLayouts } from '../../hooks/useLayoutState';

/**
 * Layout sync service — the app-level seam between the UI and the platform
 * backend.
 *
 * - When the platform is `local`, sync is a no-op (localStorage already holds
 *   the data, so pull/push are trivially consistent).
 * - When the platform is `supabase` and an organization is known, saved layouts
 *   are pulled from the backend on load and pushed on save, so multiple
 *   devices/users in the same organization see the same layouts.
 */
export function canSyncLayouts(organizationId: string | null | undefined): boolean {
  return getPlatformProvider() === 'supabase' && Boolean(organizationId);
}

export async function pullLayouts(context: LayoutSyncContext): Promise<void> {
  const repo = getLayoutRepository();
  const remote = await repo.loadAll(context);
  // Always overwrite the local store with the backend's layouts — including an
  // empty result — so the UI reflects the shared source of truth and stale local
  // layouts are never retained when the server correctly has none (P1-5).
  const { setSavedLayouts } = await import('../../hooks/useLayoutState');
  setSavedLayouts(remote);
}

export async function pushLayouts(context: LayoutSyncContext): Promise<void> {
  const repo = getLayoutRepository();
  await repo.saveAll(context, getSavedLayouts());
}
