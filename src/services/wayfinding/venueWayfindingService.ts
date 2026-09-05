import {
  VenueMapConfig,
  VenueMapPoint,
  VenueMapPointKind,
  VenueMapRoute,
  VenueMapAudience,
  VenueMapRouteAccessibility,
  DrawingObject,
  RainContingency,
  VenueRulesConfig,
} from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';
import {
  INVALID_VENUE_MAP_EVENT_SCOPE,
  projectVenueMap,
} from '../../utils/venueMapDesigner';

const MAP_KEY = STORAGE_KEYS.VENUE_MAP_CONFIGS;
const MAP_VERSION = STORAGE_VERSIONS.VENUE_MAP_CONFIGS;
const RULES_KEY = STORAGE_KEYS.VENUE_RULES;
const RULES_VERSION = STORAGE_VERSIONS.VENUE_RULES;

const POINT_KINDS = new Set<VenueMapPointKind>(['space', 'parking', 'entry', 'amenity', 'path']);
const AUDIENCES = new Set<VenueMapAudience>(['public', 'couple', 'staff']);
const ACCESSIBILITY = new Set<VenueMapRouteAccessibility>(['unknown', 'step-free', 'not-step-free']);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function optionalText(value: unknown, maxLength = 1000): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || undefined;
}

function stringIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()))];
  return ids.length ? ids : undefined;
}

function normalizedEventSpaceIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [INVALID_VENUE_MAP_EVENT_SCOPE];
  if (value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    return [INVALID_VENUE_MAP_EVENT_SCOPE];
  }
  const ids = [...new Set(value.map((item) => item.trim()))];
  return ids.length ? ids : undefined;
}

function normalizedAudience(value: unknown): VenueMapAudience {
  // Audience-less legacy objects were historically public. An explicitly
  // present null, blank, or malformed value is different: keep it staff-only
  // rather than failing open. (JSON cannot preserve an explicitly undefined
  // property, so undefined is the reliable legacy/missing signal here.)
  if (value === undefined) return 'public';
  return typeof value === 'string' && AUDIENCES.has(value as VenueMapAudience)
    ? value as VenueMapAudience
    : 'staff';
}

function safeColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const color = value.trim();
  return color === 'transparent' || /^#[0-9a-f]{3,8}$/i.test(color) ? color : undefined;
}

function safeBackgroundRef(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 5 * 1024 * 1024) return undefined;
  if (/^https:\/\//i.test(value)) return value;
  if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)) return value;
  if (/^sp:\/\/(venue-map-images|venue-images)\/[a-z0-9-]+\//i.test(value)) return value;
  return undefined;
}

/**
 * Normalize untrusted local/cloud JSON into the canonical venue-map contract.
 * Objects are rebuilt from an allowlist so unknown/internal fields cannot ride
 * along into couple or guest projections.
 */
export function normalizeVenueMapConfig(value: unknown): VenueMapConfig | null {
  const source = record(value);
  if (!source) return null;
  const width = boundedNumber(source.width, 100, 20, 500);
  const height = boundedNumber(source.height, 80, 20, 500);

  const points: VenueMapPoint[] = [];
  const pointIds = new Set<string>();
  for (const candidate of Array.isArray(source.points) ? source.points : []) {
    const item = record(candidate);
    if (!item) continue;
    const id = optionalText(item.id, 200);
    const kind = typeof item.kind === 'string' && POINT_KINDS.has(item.kind as VenueMapPointKind)
      ? item.kind as VenueMapPointKind
      : null;
    if (!id || pointIds.has(id) || !kind) continue;
    pointIds.add(id);
    const latitude = item.lat;
    const longitude = item.lng;
    const hasGpsPair = typeof latitude === 'number' && Number.isFinite(latitude)
      && latitude >= -90 && latitude <= 90
      && typeof longitude === 'number' && Number.isFinite(longitude)
      && longitude >= -180 && longitude <= 180;
    points.push({
      id,
      label: optionalText(item.label, 200) || 'Map point',
      description: optionalText(item.description),
      x: boundedNumber(item.x, 0, 0, width),
      y: boundedNumber(item.y, 0, 0, height),
      kind,
      audience: normalizedAudience(item.audience),
      eventSpaceIds: normalizedEventSpaceIds(item.eventSpaceIds),
      venueId: optionalText(item.venueId, 200),
      lat: hasGpsPair ? latitude : undefined,
      lng: hasGpsPair ? longitude : undefined,
    });
  }

  const routes: VenueMapRoute[] = [];
  const routeIds = new Set<string>();
  for (const candidate of Array.isArray(source.routes) ? source.routes : []) {
    const item = record(candidate);
    if (!item) continue;
    const id = optionalText(item.id, 200);
    if (!id || routeIds.has(id)) continue;
    const orderedPointIds = stringIds(item.pointIds)?.filter((pointId) => pointIds.has(pointId)) || [];
    if (orderedPointIds.length < 2) continue;
    routeIds.add(id);
    routes.push({
      id,
      name: optionalText(item.name, 200) || 'Path',
      pointIds: orderedPointIds,
      audience: normalizedAudience(item.audience),
      eventSpaceIds: normalizedEventSpaceIds(item.eventSpaceIds),
      accessibility: typeof item.accessibility === 'string' && ACCESSIBILITY.has(item.accessibility as VenueMapRouteAccessibility)
        ? item.accessibility as VenueMapRouteAccessibility
        : 'unknown',
      notes: optionalText(item.notes),
    });
  }

  const drawings: DrawingObject[] = [];
  const drawingIds = new Set<string>();
  for (const candidate of Array.isArray(source.drawings) ? source.drawings : []) {
    const item = record(candidate);
    if (!item) continue;
    const id = optionalText(item.id, 200);
    const type = optionalText(item.type, 50);
    if (!id || !type || drawingIds.has(id)) continue;
    drawingIds.add(id);
    const drawingPoints = Array.isArray(item.points)
      ? item.points.flatMap((candidatePoint) => {
          const point = record(candidatePoint);
          return point ? [{
            x: boundedNumber(point.x, 0, 0, width),
            y: boundedNumber(point.y, 0, 0, height),
          }] : [];
        })
      : undefined;
    drawings.push({
      id,
      type,
      x: boundedNumber(item.x, 0, 0, width),
      y: boundedNumber(item.y, 0, 0, height),
      width: typeof item.width === 'number' ? boundedNumber(item.width, 1, 1, width) : undefined,
      height: typeof item.height === 'number' ? boundedNumber(item.height, 1, 1, height) : undefined,
      points: drawingPoints,
      rotation: typeof item.rotation === 'number' ? boundedNumber(item.rotation, 0, -360, 360) : undefined,
      fillColor: safeColor(item.fillColor),
      strokeColor: safeColor(item.strokeColor),
      strokeWidth: typeof item.strokeWidth === 'number' ? boundedNumber(item.strokeWidth, 1, 0.1, 20) : undefined,
      opacity: typeof item.opacity === 'number' ? boundedNumber(item.opacity, 1, 0, 1) : undefined,
      fontSize: typeof item.fontSize === 'number' ? boundedNumber(item.fontSize, 12, 1, 100) : undefined,
      text: optionalText(item.text, 300),
      radius: typeof item.radius === 'number' ? boundedNumber(item.radius, 1, 1, Math.min(width, height) / 2) : undefined,
      audience: normalizedAudience(item.audience),
      eventSpaceIds: normalizedEventSpaceIds(item.eventSpaceIds),
    });
  }

  const rainContingencies: RainContingency[] = [];
  const contingencyIds = new Set<string>();
  for (const candidate of Array.isArray(source.rainContingencies) ? source.rainContingencies : []) {
    const item = record(candidate);
    if (!item) continue;
    const id = optionalText(item.id, 200);
    const outdoorVenueId = optionalText(item.outdoorVenueId, 200);
    const indoorVenueId = optionalText(item.indoorVenueId, 200);
    if (!id || !outdoorVenueId || !indoorVenueId || contingencyIds.has(id)) continue;
    contingencyIds.add(id);
    rainContingencies.push({ id, outdoorVenueId, indoorVenueId, note: optionalText(item.note) });
  }

  const backgroundImageUrl = safeBackgroundRef(source.backgroundImageUrl);
  return {
    width,
    height,
    points,
    routes,
    drawings,
    rainContingencies,
    backgroundImageUrl,
    backgroundOpacity: backgroundImageUrl
      ? boundedNumber(source.backgroundOpacity, 0.85, 0.1, 1)
      : undefined,
    updatedAt: optionalText(source.updatedAt, 100) || new Date().toISOString(),
  };
}

export function getVenueMapConfig(): VenueMapConfig | null {
  return loadVersionedStorage<VenueMapConfig | null>({
    key: MAP_KEY,
    defaultValue: null,
    currentVersion: MAP_VERSION,
    validate: (v): v is VenueMapConfig | null => v === null || normalizeVenueMapConfig(v) !== null,
    normalize: (v) => normalizeVenueMapConfig(v),
  });
}

export function saveVenueMapConfig(config: VenueMapConfig): void {
  const normalized = normalizeVenueMapConfig(config);
  if (!normalized) throw new Error('Venue map data is invalid and was not saved.');
  saveVersionedStorage(MAP_KEY, MAP_VERSION, normalized);
}

export function emptyVenueMapConfig(): VenueMapConfig {
  return {
    width: 100,
    height: 80,
    points: [],
    rainContingencies: [],
    routes: [],
    drawings: [],
    updatedAt: new Date().toISOString(),
  };
}

/** Resolve a route's ordered coordinates from its point ids. */
export function routePolyline(map: VenueMapConfig | null, routeId: string): { x: number; y: number }[] {
  if (!map) return [];
  const route = (map.routes || []).find((r) => r.id === routeId);
  if (!route) return [];
  const byId = new Map(map.points.map((p) => [p.id, p]));
  return route.pointIds.map((id) => byId.get(id)).filter(Boolean).map((p) => ({ x: p!.x, y: p!.y }));
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
  return projectVenueMap(map, 'couple', selectedVenueIds).points.filter(
    (point) => point.kind !== 'path',
  );
}
