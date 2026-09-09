import { getPlatformProvider } from '../platform';
import {
  captureEntityDomainPayload,
  getEntityDomainRevision,
  getEntityRepository,
  type EntitySyncContext,
  type VenueMapSaveResult,
} from '../repository/entityRepository';

export type { EntitySyncContext };
import {
  affectsCouplePortalSnapshots,
  pullAllCouplePortalSnapshotsForVenue,
  syncAllCouplePortalSnapshots,
} from '../couples/coupleCloudSync';
import { syncCoupleRelationalProjection } from '../couples/coupleProjection';
import { emit, emitDataChanged } from '../../utils/appEvents';

// Same-domain writes must reach the server in invocation order. Without a
// per-organization/domain tail, two independent fetch requests can complete in
// reverse order and let an older payload overwrite a newer captured save.
const entityDomainPushTails = new Map<string, Promise<void>>();

function enqueueEntityDomainPush(
  context: EntitySyncContext,
  domain: string,
  push: () => Promise<void>,
): Promise<void> {
  const key = `${context.organizationId}\u0000${domain}`;
  const previous = entityDomainPushTails.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(push);
  entityDomainPushTails.set(key, current);

  // Keep a rejected push observable to its caller while ensuring queue cleanup
  // itself never creates an unhandled rejected promise.
  void current
    .finally(() => {
      if (entityDomainPushTails.get(key) === current) entityDomainPushTails.delete(key);
    })
    .catch(() => undefined);

  return current;
}

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

export function pushEntityDomain(
  context: EntitySyncContext,
  domain: string,
): Promise<void> {
  // Capture now: a self-realtime refresh may replace the shared browser cache
  // while this write waits, but it must not replace the payload this save meant
  // to publish.
  const captured = {
    ...captureEntityDomainPayload(domain),
    expectedUpdatedAt: getEntityDomainRevision(context.organizationId, domain),
  };
  return enqueueEntityDomainPush(context, domain, async () => {
    const repo = getEntityRepository();
    await repo.pushDomain(context, domain, captured);
    if (repo.provider === 'supabase' && affectsCouplePortalSnapshots(domain)) {
      const snapshotOverrides = captured.found
        && (domain === 'venueMapConfigs' || domain === 'spm_venue_map_configs')
        ? { venueMapConfig: captured.payload }
        : undefined;
      await syncAllCouplePortalSnapshots(context, snapshotOverrides);
      // Only couple-owned relational domains need the relational projection. A
      // global map/rules/weather update should refresh portal snapshots without
      // rewriting unrelated couple rows.
      if (domain === 'all' || domain.includes('couple') || domain === 'spm_couple_events') {
        await syncCoupleRelationalProjection(context);
      }
    }
  });
}

/**
 * Save Venue Map geometry against the exact server revision loaded by this
 * editor. The queue is shared with generic domain pushes so same-tab writes stay
 * ordered, while the database compare-and-swap protects other tabs/devices.
 */
export async function saveVenueMapEntity(
  context: EntitySyncContext,
  payload: unknown,
  expectedUpdatedAt: string | null | undefined,
  force = false,
): Promise<VenueMapSaveResult> {
  let outcome: VenueMapSaveResult | undefined;
  await enqueueEntityDomainPush(context, 'venueMapConfigs', async () => {
    const repo = getEntityRepository();
    outcome = await repo.saveVenueMap(context, payload, expectedUpdatedAt, force);
    if (outcome.status !== 'saved' || repo.provider !== 'supabase') return;
    try {
      await syncAllCouplePortalSnapshots(context, { venueMapConfig: payload });
    } catch (error) {
      // The canonical row is already saved and the guest RPC rebuilds from it at
      // read time. Surface denormalized couple-snapshot publication separately;
      // never tell the editor its successful CAS failed and invite a stale retry.
      emit('spm_cloud_sync_error', {
        domain: 'venue map portal snapshots',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });
  if (!outcome) throw new Error('Venue map save did not complete.');
  return outcome;
}
