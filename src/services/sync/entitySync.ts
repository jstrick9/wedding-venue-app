import { getPlatformProvider } from '../platform';
import { getEntityRepository, type EntitySyncContext } from '../repository/entityRepository';

export type { EntitySyncContext };
import {
  affectsCouplePortalSnapshots,
  pullAllCouplePortalSnapshotsForVenue,
  syncAllCouplePortalSnapshots,
} from '../couples/coupleCloudSync';
import { syncCoupleRelationalProjection } from '../couples/coupleProjection';
import { emitDataChanged } from '../../utils/appEvents';

/**
 * Entity sync service — the app-level seam for the catalog/asset/design domains.
 * Like layoutSync, it's a no-op in local mode and pushes/pulls the org's entity
 * domains to/from Supabase when the platform is enabled.
 */
export function canSyncEntities(organizationId: string | null | undefined): boolean {
  return getPlatformProvider() === 'supabase' && Boolean(organizationId);
}

export async function pullEntities(
  context: EntitySyncContext,
  shouldApply: () => boolean = () => true,
): Promise<boolean> {
  const repo = getEntityRepository();
  const entitiesApplied = await repo.pullAll(context, shouldApply);
  if (entitiesApplied === false || !shouldApply()) return false;
  if (repo.provider === 'supabase') {
    const snapshotsApplied = await pullAllCouplePortalSnapshotsForVenue(context, shouldApply);
    if (snapshotsApplied === false || !shouldApply()) return false;
  }
  emitDataChanged('backend_hydrated', 'backend');
  return true;
}

export async function pushEntities(context: EntitySyncContext): Promise<void> {
  const repo = getEntityRepository();
  await repo.pushAll(context);
  if (repo.provider === 'supabase') {
    await syncAllCouplePortalSnapshots(context);
    await syncCoupleRelationalProjection(context);
  }
}

export async function pushEntityDomain(
  context: EntitySyncContext,
  domain: string,
): Promise<void> {
  const repo = getEntityRepository();
  await repo.pushDomain(context, domain);
  if (repo.provider === 'supabase' && affectsCouplePortalSnapshots(domain)) {
    await syncAllCouplePortalSnapshots(context);
    // Only couple-owned relational domains need the relational projection. A
    // global map/rules/weather update should refresh portal snapshots without
    // rewriting unrelated couple rows.
    if (domain === 'all' || domain.includes('couple') || domain === 'spm_couple_events') {
      await syncCoupleRelationalProjection(context);
    }
  }
}
