import { getPlatformProvider } from '../platform';
import { getEntityRepository, type EntitySyncContext } from '../repository/entityRepository';

export type { EntitySyncContext };
import {
  pullAllCouplePortalSnapshotsForVenue,
  syncAllCouplePortalSnapshots,
} from '../couples/coupleCloudSync';
import { emitDataChanged } from '../../utils/appEvents';

/**
 * Entity sync service — the app-level seam for the catalog/asset/design domains.
 * Like layoutSync, it's a no-op in local mode and pushes/pulls the org's entity
 * domains to/from Supabase when the platform is enabled.
 */
export function canSyncEntities(organizationId: string | null | undefined): boolean {
  return getPlatformProvider() === 'supabase' && Boolean(organizationId);
}

export async function pullEntities(context: EntitySyncContext): Promise<void> {
  const repo = getEntityRepository();
  await repo.pullAll(context);
  if (repo.provider === 'supabase') {
    await pullAllCouplePortalSnapshotsForVenue(context);
  }
  emitDataChanged('backend_hydrated');
}

export async function pushEntities(context: EntitySyncContext): Promise<void> {
  const repo = getEntityRepository();
  await repo.pushAll(context);
  if (repo.provider === 'supabase') {
    await syncAllCouplePortalSnapshots(context);
  }
}

export async function pushEntityDomain(
  context: EntitySyncContext,
  domain: string,
): Promise<void> {
  const repo = getEntityRepository();
  await repo.pushDomain(context, domain);
  if (
    repo.provider === 'supabase' &&
    (domain === 'all' || domain === 'coupleEvents' || domain === 'spm_couple_events' || domain.includes('couple'))
  ) {
    await syncAllCouplePortalSnapshots(context);
  }
}
