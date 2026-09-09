import type { VenueMapConfig } from '../../types';

export type VenueMapCloudSaveOutcome =
  | { status: 'saved'; updatedAt: string | null }
  | { status: 'conflict'; currentPayload: unknown; currentUpdatedAt: string | null }
  | { status: 'error'; error: string };

export type VenueMapCoordinatedSaveOutcome =
  | { status: 'saved'; updatedAt?: string | null }
  | { status: 'conflict' }
  | { status: 'error' };

interface CoordinateVenueMapSaveOptions {
  cloudEnabled: boolean;
  map: VenueMapConfig;
  expectedUpdatedAt: string | null | undefined;
  saveToCloud: (
    map: VenueMapConfig,
    expectedUpdatedAt: string | null | undefined,
  ) => Promise<VenueMapCloudSaveOutcome>;
  saveToCanonicalCache: (map: VenueMapConfig, emitChange: boolean) => void;
  onConflict: (conflict: {
    localMap: VenueMapConfig;
    currentPayload: unknown;
    currentUpdatedAt: string | null;
  }) => void;
}

/**
 * Publishes a Venue Map without allowing a rejected cloud draft to become the
 * browser's canonical copy. Local-only work persists immediately; cloud work is
 * promoted to the canonical cache only after compare-and-swap succeeds.
 */
export async function coordinateVenueMapSave({
  cloudEnabled,
  map,
  expectedUpdatedAt,
  saveToCloud,
  saveToCanonicalCache,
  onConflict,
}: CoordinateVenueMapSaveOptions): Promise<VenueMapCoordinatedSaveOutcome> {
  if (!cloudEnabled) {
    saveToCanonicalCache(map, true);
    return { status: 'saved' };
  }

  const result = await saveToCloud(map, expectedUpdatedAt);
  if (result.status === 'conflict') {
    onConflict({
      localMap: map,
      currentPayload: result.currentPayload,
      currentUpdatedAt: result.currentUpdatedAt,
    });
    return { status: 'conflict' };
  }
  if (result.status === 'error') return { status: 'error' };

  try {
    saveToCanonicalCache(map, false);
  } catch {
    // The server CAS already succeeded. The storage layer owns its actionable
    // warning; never retry a successful write from what is now a stale base.
  }
  return { status: 'saved', updatedAt: result.updatedAt };
}
