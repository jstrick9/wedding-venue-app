import {
  VenueMapConfig,
  VenueMapPoint,
  VenueMapPointKind,
  VenueMapRoute,
} from '../types';

/**
 * Pure helpers for the interactive full-venue map designer. Kept dependency-free
 * so the Design Studio can edit the venue map as an interactive canvas (drag /
 * click-to-place / route-drawing) and print/export the resulting "Venue Map".
 */

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** A point's kind-dependent accent color (shared by designer + read-only views). */
export function pointColor(kind: VenueMapPointKind): string {
  switch (kind) {
    case 'space': return '#0d9488'; // teal
    case 'parking': return '#6366f1'; // indigo
    case 'entry': return '#16a34a'; // green
    case 'amenity': return '#f59e0b'; // amber
    case 'path': return '#94a3b8'; // slate
    default: return '#94a3b8';
  }
}

export function pointKindLabel(kind: VenueMapPointKind): string {
  switch (kind) {
    case 'space': return 'Event Space';
    case 'parking': return 'Parking';
    case 'entry': return 'Entry / Exit';
    case 'amenity': return 'Amenity';
    case 'path': return 'Path';
    default: return 'Point';
  }
}

export function pointKindIcon(kind: VenueMapPointKind): string {
  switch (kind) {
    case 'space': return '🏛️';
    case 'parking': return '🅿️';
    case 'entry': return '🚪';
    case 'amenity': return '⛲';
    case 'path': return '•';
    default: return '📍';
  }
}

/** Add a new point to the map. Coordinates are clamped to the map bounds. */
export function addMapPoint(
  map: VenueMapConfig,
  input: Omit<VenueMapPoint, 'id'>,
): VenueMapConfig {
  const x = clampCoord(input.x, map.width);
  const y = clampCoord(input.y, map.height);
  return {
    ...map,
    points: [...map.points, { ...input, id: uid('pt'), x, y }],
    updatedAt: new Date().toISOString(),
  };
}

function clampCoord(v: number, max: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(Math.round(v * 10) / 10, max));
}

/** Move an existing point to a new position (clamped). */
export function moveMapPoint(
  map: VenueMapConfig,
  pointId: string,
  x: number,
  y: number,
): VenueMapConfig {
  return {
    ...map,
    points: map.points.map((p) =>
      p.id === pointId
        ? { ...p, x: clampCoord(x, map.width), y: clampCoord(y, map.height) }
        : p,
    ),
    updatedAt: new Date().toISOString(),
  };
}

/** Update a point's metadata (label, kind, venue linkage, GPS, description). */
export function updateMapPoint(
  map: VenueMapConfig,
  pointId: string,
  patch: Partial<Omit<VenueMapPoint, 'id' | 'x' | 'y'>>,
): VenueMapConfig {
  return {
    ...map,
    points: map.points.map((p) => (p.id === pointId ? { ...p, ...patch } : p)),
    updatedAt: new Date().toISOString(),
  };
}

/** Remove a point and prune it from any routes that referenced it. */
export function removeMapPoint(
  map: VenueMapConfig,
  pointId: string,
): VenueMapConfig {
  return {
    ...map,
    points: map.points.filter((p) => p.id !== pointId),
    routes: (map.routes || []).map((r) => ({
      ...r,
      pointIds: r.pointIds.filter((id) => id !== pointId),
    })),
    updatedAt: new Date().toISOString(),
  };
}

/** Add a named walkway route connecting the given ordered point ids. */
export function addMapRoute(
  map: VenueMapConfig,
  name: string,
  pointIds: string[],
): VenueMapConfig {
  if (pointIds.length < 2) return map;
  return {
    ...map,
    routes: [
      ...(map.routes || []),
      { id: uid('route'), name: name.trim() || 'Path', pointIds },
    ],
    updatedAt: new Date().toISOString(),
  };
}

/** Remove a walkway route. */
export function removeMapRoute(
  map: VenueMapConfig,
  routeId: string,
): VenueMapConfig {
  return {
    ...map,
    routes: (map.routes || []).filter((r) => r.id !== routeId),
    updatedAt: new Date().toISOString(),
  };
}

/** Ordered coordinates for a route (for SVG polyline). */
export function routePoints(
  map: VenueMapConfig | null,
  route: VenueMapRoute,
): { x: number; y: number }[] {
  if (!map) return [];
  const byId = new Map(map.points.map((p) => [p.id, p]));
  return route.pointIds
    .map((id) => byId.get(id))
    .filter((p): p is VenueMapPoint => !!p)
    .map((p) => ({ x: p.x, y: p.y }));
}

/** All point ids currently on the map (for building routes). */
export function mapPointIds(map: VenueMapConfig): string[] {
  return map.points.map((p) => p.id);
}
