import {
  VenueMapConfig,
  VenueMapPoint,
  RainContingency,
  VenueRulesConfig,
} from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const MAP_KEY = STORAGE_KEYS.VENUE_MAP_CONFIGS;
const MAP_VERSION = STORAGE_VERSIONS.VENUE_MAP_CONFIGS;
const RULES_KEY = STORAGE_KEYS.VENUE_RULES;
const RULES_VERSION = STORAGE_VERSIONS.VENUE_RULES;

export function getVenueMapConfig(): VenueMapConfig | null {
  return loadVersionedStorage<VenueMapConfig | null>({
    key: MAP_KEY,
    defaultValue: null,
    currentVersion: MAP_VERSION,
    validate: (v): v is VenueMapConfig => !!v && typeof v === 'object',
    normalize: (v) => (v ? (v as VenueMapConfig) : null),
  });
}

export function saveVenueMapConfig(config: VenueMapConfig): void {
  saveVersionedStorage(MAP_KEY, MAP_VERSION, config);
}

export function emptyVenueMapConfig(): VenueMapConfig {
  return { width: 100, height: 80, points: [], rainContingencies: [], updatedAt: new Date().toISOString() };
}

export function getVenueRules(): VenueRulesConfig {
  return loadVersionedStorage<VenueRulesConfig>({
    key: RULES_KEY,
    defaultValue: { rules: [], updatedAt: new Date().toISOString() },
    currentVersion: RULES_VERSION,
    validate: (v): v is VenueRulesConfig => !!v && typeof v === 'object',
    normalize: (v) => (v ? (v as VenueRulesConfig) : { rules: [], updatedAt: new Date().toISOString() }),
  });
}

export function saveVenueRules(rules: string[]): void {
  saveVersionedStorage(RULES_KEY, RULES_VERSION, {
    rules: rules.filter((r) => r && r.trim()),
    updatedAt: new Date().toISOString(),
  });
}

/** Resolve the rain-contingency indoor space for a given outdoor venue, if any. */
export function findRainContingency(
  map: VenueMapConfig | null,
  outdoorVenueId: string,
): RainContingency | undefined {
  return map?.rainContingencies.find((c) => c.outdoorVenueId === outdoorVenueId);
}

/**
 * The wayfinding points a couple sees: their selected spaces (+ their rain-contingency
 * backups), plus parking and entry points, from the venue's full-property map.
 */
export function coupleWayfindingPoints(
  map: VenueMapConfig | null,
  selectedVenueIds: string[],
): VenueMapPoint[] {
  if (!map) return [];
  const backupIds = (map.rainContingencies || [])
    .filter((c) => selectedVenueIds.includes(c.outdoorVenueId))
    .map((c) => c.indoorVenueId);
  const relevantVenueIds = new Set([...selectedVenueIds, ...backupIds]);
  return (map.points || []).filter(
    (p) =>
      p.kind === 'parking' ||
      p.kind === 'entry' ||
      p.kind === 'amenity' ||
      (p.kind === 'space' && p.venueId && relevantVenueIds.has(p.venueId)),
  );
}
