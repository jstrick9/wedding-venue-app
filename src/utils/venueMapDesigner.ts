import {
  VenueMapConfig,
  VenueMapPoint,
  VenueMapPointKind,
  VenueMapRoute,
  DrawingObject,
} from '../types';

/**
 * Pure helpers for the interactive full-venue map designer. Kept dependency-free
 * so the Design Studio can edit the venue map as an interactive canvas (drag /
 * click-to-place / route-drawing) and print/export the resulting "Venue Map".
 */

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Minimum/maximum map canvas dimensions (abstract map units). */
const MIN_SIZE = 20;
const MAX_SIZE = 500;

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

function clampSize(v: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(MIN_SIZE, Math.min(Math.round(v), MAX_SIZE));
}

/** Resize the map canvas, clamping every point back into the new bounds. */
export function updateMapSize(
  map: VenueMapConfig,
  width: number,
  height: number,
): VenueMapConfig {
  const w = clampSize(width, map.width);
  const h = clampSize(height, map.height);
  const clampPoint = (p: VenueMapPoint) => ({
    ...p,
    x: clampCoord(p.x, w),
    y: clampCoord(p.y, h),
  });
  return {
    ...map,
    width: w,
    height: h,
    points: map.points.map(clampPoint),
    updatedAt: new Date().toISOString(),
  };
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
    // A walkway needs at least 2 points to render; drop any route that falls
    // below that after the point is removed.
    routes: (map.routes || [])
      .map((r) => ({
        ...r,
        pointIds: r.pointIds.filter((id) => id !== pointId),
      }))
      .filter((r) => r.pointIds.length >= 2),
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

/** Rename a walkway route (blank input keeps the existing name). */
export function renameMapRoute(
  map: VenueMapConfig,
  routeId: string,
  name: string,
): VenueMapConfig {
  const trimmed = (name || '').trim();
  return {
    ...map,
    routes: (map.routes || []).map((r) =>
      r.id === routeId ? { ...r, name: trimmed || r.name } : r,
    ),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Duplicate an existing point at a small offset (clamped to bounds). The copy is
 * labeled "<original> (copy)" so it's distinguishable; it does not join any
 * existing walkway routes.
 */
export function duplicateMapPoint(
  map: VenueMapConfig,
  pointId: string,
  offset = 8,
): VenueMapConfig {
  const src = map.points.find((p) => p.id === pointId);
  if (!src) return map;
  const x = clampCoord(src.x + offset, map.width);
  const y = clampCoord(src.y + offset, map.height);
  const copy: VenueMapPoint = {
    ...src,
    id: uid('pt'),
    x,
    y,
    label: `${src.label} (copy)`,
  };
  return {
    ...map,
    points: [...map.points, copy],
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

export function updateMapBackground(
  map: VenueMapConfig,
  backgroundImageUrl?: string,
  backgroundOpacity?: number,
): VenueMapConfig {
  return {
    ...map,
    backgroundImageUrl,
    backgroundOpacity,
    updatedAt: new Date().toISOString(),
  };
}

export function addMapDrawing(
  map: VenueMapConfig,
  drawing: DrawingObject,
): VenueMapConfig {
  return {
    ...map,
    drawings: [...(map.drawings || []), drawing],
    updatedAt: new Date().toISOString(),
  };
}

export function removeMapDrawing(
  map: VenueMapConfig,
  id: string,
): VenueMapConfig {
  return {
    ...map,
    drawings: (map.drawings || []).filter((d) => d.id !== id),
    updatedAt: new Date().toISOString(),
  };
}

export function clearMapDrawings(map: VenueMapConfig): VenueMapConfig {
  return {
    ...map,
    drawings: [],
    updatedAt: new Date().toISOString(),
  };
}

export function addPresetMapZones(map: VenueMapConfig): VenueMapConfig {
  const now = Date.now();
  const presets: DrawingObject[] = [
    {
      id: `zone-ceremony-${now}`,
      type: 'zone',
      x: 10,
      y: 15,
      width: 28,
      height: 18,
      fillColor: '#10b981',
      strokeColor: '#059669',
      strokeWidth: 1.2,
      opacity: 0.22,
      text: '🌳 Ceremony Lawn Zone',
    },
    {
      id: `zone-parking-${now}`,
      type: 'zone',
      x: 65,
      y: 55,
      width: 26,
      height: 18,
      fillColor: '#6366f1',
      strokeColor: '#4f46e5',
      strokeWidth: 1.2,
      opacity: 0.22,
      text: '🅿️ Main Parking Lot',
    },
    {
      id: `zone-manor-${now}`,
      type: 'zone',
      x: 42,
      y: 20,
      width: 25,
      height: 22,
      fillColor: '#4A1942',
      strokeColor: '#3b1435',
      strokeWidth: 1.5,
      opacity: 0.25,
      text: '🏛️ Main Manor Building',
    },
    {
      id: `zone-gardens-${now}`,
      type: 'zone',
      x: 15,
      y: 45,
      width: 22,
      height: 22,
      fillColor: '#0d9488',
      strokeColor: '#0f766e',
      strokeWidth: 1.2,
      opacity: 0.22,
      text: '🌿 Gardens Boundary',
    },
  ];
  return {
    ...map,
    drawings: [...(map.drawings || []), ...presets],
    updatedAt: new Date().toISOString(),
  };
}
