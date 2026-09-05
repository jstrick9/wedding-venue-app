import {
  VenueMapConfig,
  VenueMapPoint,
  VenueMapPointKind,
  VenueMapRoute,
  VenueMapAudience,
  VenueMapViewer,
  VenueMapRouteAccessibility,
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

export const MAP_AUDIENCES: VenueMapAudience[] = ['public', 'couple', 'staff'];
/** Internal fail-closed marker produced when untrusted event-scope JSON is malformed. */
export const INVALID_VENUE_MAP_EVENT_SCOPE = '__invalid_event_scope__';

export function mapAudienceLabel(audience: VenueMapAudience | undefined): string {
  switch (audience === undefined ? 'public' : audience) {
    case 'public': return 'Guests & couples';
    case 'couple': return 'Couples only';
    case 'staff': return 'Staff only';
    default: return 'Staff only';
  }
}

/** Whether a map object may be rendered or delivered to this viewer. */
export function isMapAudienceVisible(
  audience: VenueMapAudience | undefined,
  viewer: VenueMapViewer,
): boolean {
  if (viewer === 'staff') return true;
  const required = audience === undefined ? 'public' : audience;
  if (!MAP_AUDIENCES.includes(required)) return false;
  if (viewer === 'couple') return required !== 'staff';
  return required === 'public';
}

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
  const clampDrawing = (drawing: DrawingObject): DrawingObject => {
    const width = drawing.width == null ? undefined : Math.max(1, Math.min(drawing.width, w));
    const height = drawing.height == null ? undefined : Math.max(1, Math.min(drawing.height, h));
    return {
      ...drawing,
      x: clampCoord(drawing.x, width == null ? w : Math.max(0, w - width)),
      y: clampCoord(drawing.y, height == null ? h : Math.max(0, h - height)),
      width,
      height,
      points: drawing.points?.map((point) => ({
        x: clampCoord(point.x, w),
        y: clampCoord(point.y, h),
      })),
      radius: drawing.radius == null ? undefined : Math.max(1, Math.min(drawing.radius, Math.min(w, h) / 2)),
    };
  };
  return {
    ...map,
    width: w,
    height: h,
    points: map.points.map(clampPoint),
    drawings: map.drawings?.map(clampDrawing),
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

/** Add a named walkway route connecting valid, unique ordered map points. */
export function addMapRoute(
  map: VenueMapConfig,
  name: string,
  pointIds: string[],
  options: {
    audience?: VenueMapAudience;
    accessibility?: VenueMapRouteAccessibility;
    notes?: string;
    eventSpaceIds?: string[];
  } = {},
): VenueMapConfig {
  const existing = new Set(map.points.map((point) => point.id));
  const validPointIds = pointIds.filter(
    (id, index) => existing.has(id) && pointIds.indexOf(id) === index,
  );
  if (validPointIds.length < 2) return map;
  return {
    ...map,
    routes: [
      ...(map.routes || []),
      {
        id: uid('route'),
        name: name.trim() || 'Path',
        pointIds: validPointIds,
        audience: options.audience || 'public',
        accessibility: options.accessibility || 'unknown',
        notes: options.notes?.trim() || undefined,
        eventSpaceIds: options.eventSpaceIds?.length ? [...new Set(options.eventSpaceIds)] : undefined,
      },
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

export function updateMapRoute(
  map: VenueMapConfig,
  routeId: string,
  patch: Partial<Pick<VenueMapRoute, 'name' | 'audience' | 'accessibility' | 'notes' | 'pointIds' | 'eventSpaceIds'>>,
): VenueMapConfig {
  const existingPointIds = new Set(map.points.map((point) => point.id));
  return {
    ...map,
    routes: (map.routes || []).map((route) => {
      if (route.id !== routeId) return route;
      const requestedIds = patch.pointIds
        ?.filter((id, index, ids) => existingPointIds.has(id) && ids.indexOf(id) === index);
      return {
        ...route,
        ...patch,
        name: patch.name == null ? route.name : patch.name.trim() || route.name,
        notes: patch.notes == null ? route.notes : patch.notes.trim() || undefined,
        eventSpaceIds: Object.prototype.hasOwnProperty.call(patch, 'eventSpaceIds')
          ? patch.eventSpaceIds?.length ? [...new Set(patch.eventSpaceIds)] : undefined
          : route.eventSpaceIds,
        pointIds: requestedIds && requestedIds.length >= 2 ? requestedIds : route.pointIds,
      };
    }),
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

export function updateMapDrawing(
  map: VenueMapConfig,
  id: string,
  patch: Partial<Omit<DrawingObject, 'id'>>,
): VenueMapConfig {
  return {
    ...map,
    drawings: (map.drawings || []).map((drawing) =>
      drawing.id === id ? { ...drawing, ...patch } : drawing,
    ),
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

function projectedPoint(point: VenueMapPoint): VenueMapPoint {
  return {
    id: point.id,
    label: point.label,
    description: point.description,
    x: point.x,
    y: point.y,
    kind: point.kind,
    audience: point.audience,
    eventSpaceIds: point.eventSpaceIds ? [...point.eventSpaceIds] : undefined,
    venueId: point.venueId,
    lat: point.lat,
    lng: point.lng,
  };
}

function projectedRoute(route: VenueMapRoute): VenueMapRoute {
  return {
    id: route.id,
    name: route.name,
    audience: route.audience,
    eventSpaceIds: route.eventSpaceIds ? [...route.eventSpaceIds] : undefined,
    accessibility: route.accessibility,
    notes: route.notes,
    pointIds: [...route.pointIds],
  };
}

function projectedDrawing(drawing: DrawingObject): DrawingObject {
  return {
    id: drawing.id,
    type: drawing.type,
    x: drawing.x,
    y: drawing.y,
    width: drawing.width,
    height: drawing.height,
    points: drawing.points?.map((point) => ({ x: point.x, y: point.y })),
    rotation: drawing.rotation,
    fillColor: drawing.fillColor,
    strokeColor: drawing.strokeColor,
    strokeWidth: drawing.strokeWidth,
    opacity: drawing.opacity,
    fontSize: drawing.fontSize,
    text: drawing.text,
    radius: drawing.radius,
    audience: drawing.audience,
    eventSpaceIds: drawing.eventSpaceIds ? [...drawing.eventSpaceIds] : undefined,
  };
}

function projectedContingency(contingency: VenueMapConfig['rainContingencies'][number]) {
  return {
    id: contingency.id,
    outdoorVenueId: contingency.outdoorVenueId,
    indoorVenueId: contingency.indoorVenueId,
    note: contingency.note,
  };
}

function projectedMap(
  source: VenueMapConfig,
  points: VenueMapPoint[],
  routes: VenueMapRoute[],
  drawings: DrawingObject[],
  rainContingencies: VenueMapConfig['rainContingencies'],
): VenueMapConfig {
  return {
    width: source.width,
    height: source.height,
    points: points.map(projectedPoint),
    routes: routes.map(projectedRoute),
    drawings: drawings.map(projectedDrawing),
    rainContingencies: rainContingencies.map(projectedContingency),
    backgroundImageUrl: source.backgroundImageUrl,
    backgroundOpacity: source.backgroundOpacity,
    updatedAt: source.updatedAt,
  };
}

/**
 * A safe, audience- and event-scoped projection for a map consumer. Projection
 * also rebuilds every object from an allowlist so undeclared/internal JSON fields
 * cannot leak merely because persisted input was structurally wider than its type.
 */
export function projectVenueMap(
  map: VenueMapConfig,
  viewer: VenueMapViewer,
  selectedVenueIds?: string[],
): VenueMapConfig {
  const audiencePoints = map.points.filter((point) =>
    isMapAudienceVisible(point.audience, viewer),
  );
  const audiencePointIds = new Set(audiencePoints.map((point) => point.id));
  const audienceRoutes = (map.routes || []).filter((route) =>
    isMapAudienceVisible(route.audience, viewer)
      && route.pointIds.length >= 2
      && route.pointIds.every((id) => audiencePointIds.has(id)),
  );

  if (selectedVenueIds === undefined && viewer !== 'guest') {
    return projectedMap(
      map,
      audiencePoints,
      audienceRoutes,
      (map.drawings || []).filter((drawing) =>
        isMapAudienceVisible(drawing.audience, viewer),
      ),
      map.rainContingencies || [],
    );
  }

  // A guest projection without an event context is not permission to expose
  // every event-scoped property layer. It receives only globally scoped,
  // non-space destinations until explicit event-space ids are supplied.
  const scopedVenueIds = selectedVenueIds || [];
  const backupIds = (map.rainContingencies || [])
    .filter((contingency) => scopedVenueIds.includes(contingency.outdoorVenueId))
    .map((contingency) => contingency.indoorVenueId);
  const relevantVenueIds = new Set([...scopedVenueIds, ...backupIds]);
  const appliesToEvent = (eventSpaceIds?: string[]) => {
    if (eventSpaceIds === undefined) return true;
    if (!Array.isArray(eventSpaceIds)) return false;
    if (eventSpaceIds.length === 0) return true;
    if (
      eventSpaceIds.includes(INVALID_VENUE_MAP_EVENT_SCOPE)
      || eventSpaceIds.some((id) => typeof id !== 'string' || id.length === 0)
    ) return false;
    return eventSpaceIds.some((id) => relevantVenueIds.has(id));
  };
  const scopedAudiencePoints = audiencePoints.filter((point) =>
    appliesToEvent(point.eventSpaceIds)
      && (point.kind !== 'space' || (!!point.venueId && relevantVenueIds.has(point.venueId))),
  );
  const destinationIds = new Set(
    scopedAudiencePoints
      .filter((point) => point.kind !== 'path')
      .map((point) => point.id),
  );
  const selectedSpacePointIds = new Set(
    scopedAudiencePoints
      .filter((point) => point.kind === 'space')
      .map((point) => point.id),
  );
  const allowedIds = new Set(scopedAudiencePoints.map((point) => point.id));
  const candidateRoutes = audienceRoutes.filter((route) =>
    appliesToEvent(route.eventSpaceIds)
      && route.pointIds.every((id) => allowedIds.has(id)),
  );

  // Keep only connected path components that link at least two publishable
  // destinations. This retains intermediate path nodes without exposing a
  // dangling route toward an event-unrelated space.
  const adjacency = new Map<string, Set<string>>();
  for (const route of candidateRoutes) {
    route.pointIds.forEach((id) => {
      if (!adjacency.has(id)) adjacency.set(id, new Set());
    });
    for (let index = 1; index < route.pointIds.length; index += 1) {
      const from = route.pointIds[index - 1];
      const to = route.pointIds[index];
      adjacency.get(from)?.add(to);
      adjacency.get(to)?.add(from);
    }
  }
  const eligibleComponentIds = new Set<string>();
  const visited = new Set<string>();
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const component: string[] = [];
    const queue = [start];
    visited.add(start);
    while (queue.length > 0) {
      const id = queue.shift()!;
      component.push(id);
      for (const next of adjacency.get(id) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    const destinationCount = component.filter((id) => destinationIds.has(id)).length;
    const reachesSelectedSpace = component.some((id) => selectedSpacePointIds.has(id));
    if (destinationCount >= 2 && (relevantVenueIds.size === 0 || reachesSelectedSpace)) {
      component.forEach((id) => eligibleComponentIds.add(id));
    }
  }

  const routes = candidateRoutes.filter((route) =>
    route.pointIds.every((id) => eligibleComponentIds.has(id)),
  );
  const routePointIds = new Set(routes.flatMap((route) => route.pointIds));
  const points = scopedAudiencePoints.filter((point) =>
    destinationIds.has(point.id) || routePointIds.has(point.id),
  );

  return projectedMap(
    map,
    points,
    routes,
    (map.drawings || []).filter((drawing) =>
      isMapAudienceVisible(drawing.audience, viewer)
        && appliesToEvent(drawing.eventSpaceIds),
    ),
    (map.rainContingencies || []).filter((contingency) =>
      scopedVenueIds.includes(contingency.outdoorVenueId),
    ),
  );
}

export interface VenueMapRoutePath {
  pointIds: string[];
  routes: VenueMapRoute[];
}

/** Find the shortest authored route through the map graph; never invent a path. */
export function findVenueMapRoute(
  map: VenueMapConfig,
  fromPointId: string,
  toPointId: string,
  options: { stepFreeOnly?: boolean } = {},
): VenueMapRoutePath | null {
  if (fromPointId === toPointId) return { pointIds: [fromPointId], routes: [] };
  const pointIds = new Set(map.points.map((point) => point.id));
  if (!pointIds.has(fromPointId) || !pointIds.has(toPointId)) return null;

  const adjacency = new Map<string, Array<{ pointId: string; route: VenueMapRoute }>>();
  const routes = (map.routes || []).filter((route) =>
    (!options.stepFreeOnly || route.accessibility === 'step-free')
      && route.pointIds.length >= 2
      && route.pointIds.every((id) => pointIds.has(id)),
  );
  for (const route of routes) {
    for (let index = 1; index < route.pointIds.length; index += 1) {
      const from = route.pointIds[index - 1];
      const to = route.pointIds[index];
      adjacency.set(from, [...(adjacency.get(from) || []), { pointId: to, route }]);
      adjacency.set(to, [...(adjacency.get(to) || []), { pointId: from, route }]);
    }
  }

  const queue = [fromPointId];
  const previous = new Map<string, { pointId: string; route: VenueMapRoute }>();
  const visited = new Set([fromPointId]);
  while (queue.length > 0 && !visited.has(toPointId)) {
    const current = queue.shift()!;
    for (const edge of adjacency.get(current) || []) {
      if (visited.has(edge.pointId)) continue;
      visited.add(edge.pointId);
      previous.set(edge.pointId, { pointId: current, route: edge.route });
      queue.push(edge.pointId);
    }
  }
  if (!visited.has(toPointId)) return null;

  const path = [toPointId];
  const pathRoutes: VenueMapRoute[] = [];
  let cursor = toPointId;
  while (cursor !== fromPointId) {
    const step = previous.get(cursor);
    if (!step) return null;
    path.push(step.pointId);
    pathRoutes.push(step.route);
    cursor = step.pointId;
  }
  path.reverse();
  pathRoutes.reverse();
  return {
    pointIds: path,
    routes: pathRoutes.filter((route, index) => index === 0 || route.id !== pathRoutes[index - 1].id),
  };
}
