import {
  VenueMapConfig,
  VenueMapPoint,
  VenueMapPointKind,
  VenueMapRoute,
  VenueMapAudience,
  VenueMapViewer,
  VenueMapRouteAccessibility,
  VenueMapRoutePriority,
  DrawingObject,
  RainContingency,
  Venue,
} from '../types';
import { isManagedVenueMapImageRef } from './venueMapImageRef';

/**
 * Pure helpers for the interactive full-venue map designer. Kept dependency-free
 * so the Design Studio can edit the venue map as an interactive canvas (drag /
 * click-to-place / route-drawing) and print/export the resulting "Venue Map".
 */

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Minimum/maximum map canvas dimensions (abstract map units). */
export const VENUE_MAP_FRAME_MIN = 20;
export const VENUE_MAP_FRAME_MAX = 500;
export const LEGACY_VENUE_MAP_WIDTH = 100;
export const LEGACY_VENUE_MAP_HEIGHT = 80;

/** Generous operational ceilings that keep SVG, backup, and SQL work bounded. */
export const VENUE_MAP_MAX_POINTS = 500;
export const VENUE_MAP_MAX_ROUTES = 500;
export const VENUE_MAP_MAX_DRAWINGS = 500;
export const VENUE_MAP_MAX_RAIN_CONTINGENCIES = 250;
export const VENUE_MAP_MAX_ROUTE_POINTS = 100;
export const VENUE_MAP_MAX_LINE_VERTICES = 500;
export const VENUE_MAP_MAX_SERIALIZED_BYTES = 2 * 1024 * 1024;

export const MAP_AUDIENCES: VenueMapAudience[] = ['public', 'couple', 'staff'];
export const MAP_ROUTE_PRIORITIES: VenueMapRoutePriority[] = [
  'preferred',
  'standard',
  'secondary',
  'emergency-only',
];
/** Internal fail-closed marker produced when untrusted event-scope JSON is malformed. */
export const INVALID_VENUE_MAP_EVENT_SCOPE = '__invalid_event_scope__';
/** Internal recovery marker for a malformed item in a saved route point sequence. */
export const INVALID_VENUE_MAP_POINT_REFERENCE = '__invalid_map_point_reference__';
/** Internal fail-closed marker for an explicitly present malformed route priority. */
export const INVALID_VENUE_MAP_ROUTE_PRIORITY = '__invalid_map_route_priority__' as VenueMapRoutePriority;

export function mapAudienceLabel(audience: VenueMapAudience | undefined): string {
  switch (audience === undefined ? 'public' : audience) {
    case 'public': return 'Guests & couples';
    case 'couple': return 'Couples only';
    case 'staff': return 'Staff only';
    default: return 'Staff only';
  }
}

export function routePriorityLabel(priority: VenueMapRoutePriority | undefined): string {
  switch (priority === undefined ? 'standard' : priority) {
    case 'preferred': return 'Preferred';
    case 'standard': return 'Standard';
    case 'secondary': return 'Secondary';
    case 'emergency-only': return 'Emergency only';
    default: return 'Invalid saved priority';
  }
}

/**
 * Omitted priorities are legitimate legacy Standard routes. An explicitly
 * present unsupported value is unsafe because coercing it to Standard could
 * turn a damaged Emergency-only route into routine guest directions.
 */
export function venueMapRoutePriorityIssue(route: VenueMapRoute): string | null {
  return route.priority === undefined || MAP_ROUTE_PRIORITIES.includes(route.priority)
    ? null
    : 'The saved routing priority is invalid and must be selected explicitly.';
}

export function venueMapHasInvalidRoutePriorities(map: VenueMapConfig): boolean {
  return (map.routes || []).some((route) => venueMapRoutePriorityIssue(route) !== null);
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

/** Explicit environment metadata wins; categories are a legacy fallback. */
export function isRainContingencySource(venue: Venue): boolean {
  if (venue.environment) {
    return venue.environment === 'outdoor' || venue.environment === 'both';
  }
  return venue.category === 'outdoor' || venue.category === 'ceremony';
}

/** Indoor-capable spaces can serve as rain backups, but never for themselves. */
export function isRainContingencyBackup(venue: Venue): boolean {
  if (venue.environment) {
    return venue.environment === 'indoor' || venue.environment === 'both';
  }
  return venue.category !== 'outdoor' && venue.category !== 'ceremony';
}

/**
 * Explain why a canonical rain pair is no longer publishable. Requiring exactly
 * one catalog match also fails closed if corrupt catalog data reuses an id.
 */
export function rainContingencyValidationIssue(
  contingency: RainContingency,
  venues: Venue[],
): string | null {
  if (contingency.outdoorVenueId === contingency.indoorVenueId) {
    return 'The outdoor space and indoor backup must be different.';
  }

  const outdoorMatches = venues.filter((venue) => venue.id === contingency.outdoorVenueId);
  if (outdoorMatches.length === 0) {
    return `Outdoor space “${contingency.outdoorVenueId}” no longer exists.`;
  }
  if (outdoorMatches.length > 1) {
    return `Outdoor space “${contingency.outdoorVenueId}” cannot be matched uniquely.`;
  }
  if (!isRainContingencySource(outdoorMatches[0])) {
    return `“${outdoorMatches[0].name}” is no longer marked outdoor or indoor/outdoor.`;
  }

  const backupMatches = venues.filter((venue) => venue.id === contingency.indoorVenueId);
  if (backupMatches.length === 0) {
    return `Indoor backup “${contingency.indoorVenueId}” no longer exists.`;
  }
  if (backupMatches.length > 1) {
    return `Indoor backup “${contingency.indoorVenueId}” cannot be matched uniquely.`;
  }
  if (!isRainContingencyBackup(backupMatches[0])) {
    return `“${backupMatches[0].name}” is no longer marked indoor or indoor/outdoor.`;
  }

  return null;
}

export interface VenueMapRainContingencyCollisionGroup {
  key: string;
  contingencies: RainContingency[];
  duplicatedIds: string[];
  duplicatedOutdoorVenueIds: string[];
}

export interface VenueMapRainContingencyPartition {
  map: VenueMapConfig;
  quarantinedContingencies: RainContingency[];
  collisionGroups: VenueMapRainContingencyCollisionGroup[];
}

function normalizedRainCollisionValue(value: string): string {
  return value.trim();
}

/** Duplicate plan IDs and competing plans for one outdoor source are ambiguous. */
export function rainContingencyCollisionIssues(
  contingency: RainContingency,
  contingencies: RainContingency[],
): string[] {
  const id = normalizedRainCollisionValue(contingency.id);
  const outdoorVenueId = normalizedRainCollisionValue(contingency.outdoorVenueId);
  const issues: string[] = [];
  if (contingencies.filter((candidate) =>
    normalizedRainCollisionValue(candidate.id) === id).length > 1) {
    issues.push(`Plan ID “${id}” is duplicated.`);
  }
  if (contingencies.filter((candidate) =>
    normalizedRainCollisionValue(candidate.outdoorVenueId) === outdoorVenueId).length > 1) {
    issues.push(`Outdoor space “${outdoorVenueId}” has competing rain plans.`);
  }
  return issues;
}

/**
 * Quarantine every occurrence in a rain-plan collision. A connected component
 * is used because one plan can bridge a duplicated ID and a duplicated source.
 */
export function partitionVenueMapRainContingencyCollisions(
  map: VenueMapConfig,
): VenueMapRainContingencyPartition {
  const contingencies = map.rainContingencies || [];
  const idCounts = new Map<string, number>();
  const outdoorCounts = new Map<string, number>();
  for (const contingency of contingencies) {
    const id = normalizedRainCollisionValue(contingency.id);
    const outdoorId = normalizedRainCollisionValue(contingency.outdoorVenueId);
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
    outdoorCounts.set(outdoorId, (outdoorCounts.get(outdoorId) || 0) + 1);
  }
  const conflictedIndexes = contingencies.flatMap((contingency, index) => {
    const id = normalizedRainCollisionValue(contingency.id);
    const outdoorId = normalizedRainCollisionValue(contingency.outdoorVenueId);
    return (idCounts.get(id) || 0) > 1 || (outdoorCounts.get(outdoorId) || 0) > 1
      ? [index]
      : [];
  });
  const conflictedSet = new Set(conflictedIndexes);
  const collisionGroups: VenueMapRainContingencyCollisionGroup[] = [];
  const visited = new Set<number>();
  for (const start of conflictedIndexes) {
    if (visited.has(start)) continue;
    const component: number[] = [];
    const queue = [start];
    visited.add(start);
    while (queue.length > 0) {
      const index = queue.shift()!;
      component.push(index);
      const current = contingencies[index];
      for (const candidateIndex of conflictedIndexes) {
        if (visited.has(candidateIndex)) continue;
        const candidate = contingencies[candidateIndex];
        if (
          normalizedRainCollisionValue(candidate.id) === normalizedRainCollisionValue(current.id)
          || normalizedRainCollisionValue(candidate.outdoorVenueId)
            === normalizedRainCollisionValue(current.outdoorVenueId)
        ) {
          visited.add(candidateIndex);
          queue.push(candidateIndex);
        }
      }
    }
    const groupContingencies = component.map((index) => contingencies[index]);
    collisionGroups.push({
      key: `rain-collision-${Math.min(...component)}`,
      contingencies: groupContingencies,
      duplicatedIds: [...new Set(groupContingencies
        .map((contingency) => normalizedRainCollisionValue(contingency.id))
        .filter((id) => (idCounts.get(id) || 0) > 1))],
      duplicatedOutdoorVenueIds: [...new Set(groupContingencies
        .map((contingency) => normalizedRainCollisionValue(contingency.outdoorVenueId))
        .filter((id) => (outdoorCounts.get(id) || 0) > 1))],
    });
  }
  return {
    map: {
      ...map,
      rainContingencies: contingencies.filter((_, index) => !conflictedSet.has(index)),
    },
    quarantinedContingencies: contingencies.filter((_, index) => conflictedSet.has(index)),
    collisionGroups,
  };
}

export function venueMapHasRainContingencyCollisions(map: VenueMapConfig): boolean {
  return partitionVenueMapRainContingencyCollisions(map).quarantinedContingencies.length > 0;
}

/** Scope ids that no longer resolve uniquely to the current venue catalog. */
export function unavailableVenueMapEventScopeIds(
  eventSpaceIds: string[] | undefined,
  venues: Venue[],
): string[] {
  return (eventSpaceIds || []).filter((id) => {
    const normalizedId = id.trim();
    return normalizedId === INVALID_VENUE_MAP_EVENT_SCOPE
      || normalizedId.length < 1
      || normalizedId.length > 200
      || venues.filter((venue) => (
        typeof venue.id === 'string'
        && venue.id.trim().length >= 1
        && venue.id.trim().length <= 200
        && venue.id.trim() === normalizedId
      )).length !== 1;
  });
}

/** Human-readable recovery label without surfacing the reserved sentinel. */
export function venueMapEventScopeRecoveryLabel(id: string): string {
  return id === INVALID_VENUE_MAP_EVENT_SCOPE ? 'Malformed saved scope' : id;
}

/** A space pin must resolve to one current event-space or lodging record. */
export function venueMapSpacePointLinkIssue(
  point: VenueMapPoint,
  venues: Venue[],
): string | null {
  if (point.kind !== 'space') return null;
  const venueId = point.venueId?.trim();
  if (!venueId) return 'This space pin is not linked to a current venue record.';
  const matches = venues.filter((venue) => {
    const candidateId = venue.id.trim();
    return candidateId.length <= 200 && venueId.length <= 200 && candidateId === venueId;
  });
  if (matches.length === 0) return `Linked venue ID “${point.venueId}” no longer exists.`;
  if (matches.length > 1) return `Linked venue ID “${point.venueId}” is not unique in the current catalog.`;
  return null;
}

/** Add a new point to the map. Coordinates are clamped to the map bounds. */
export function addMapPoint(
  map: VenueMapConfig,
  input: Omit<VenueMapPoint, 'id'>,
): VenueMapConfig {
  if (map.points.length >= VENUE_MAP_MAX_POINTS) return map;
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
  return Math.max(VENUE_MAP_FRAME_MIN, Math.min(Math.round(v), VENUE_MAP_FRAME_MAX));
}

function unknownRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function serializedVenueMapBytes(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined
      ? Number.POSITIVE_INFINITY
      : new TextEncoder().encode(serialized).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Validate the whole canonical complexity budget before any identity or route
 * scan. Over-budget documents are handled as one admin-only quarantine so no
 * arbitrary prefix can become an apparently authoritative map.
 */
export function venueMapComplexityIssues(value: unknown): string[] {
  const source = unknownRecord(value);
  if (!source) {
    if (value === null || value === undefined) return [];
    return serializedVenueMapBytes(value) > VENUE_MAP_MAX_SERIALIZED_BYTES
      ? [`The saved Venue Map is larger than the ${VENUE_MAP_MAX_SERIALIZED_BYTES / (1024 * 1024)} MiB canonical payload limit.`]
      : [];
  }
  const points = Array.isArray(source.points) ? source.points : [];
  const routes = Array.isArray(source.routes) ? source.routes : [];
  const drawings = Array.isArray(source.drawings) ? source.drawings : [];
  const rainContingencies = Array.isArray(source.rainContingencies)
    ? source.rainContingencies
    : [];
  const issues: string[] = [];

  if (points.length > VENUE_MAP_MAX_POINTS) {
    issues.push(`The saved Venue Map contains ${points.length} points; the operational limit is ${VENUE_MAP_MAX_POINTS}.`);
  }
  if (routes.length > VENUE_MAP_MAX_ROUTES) {
    issues.push(`The saved Venue Map contains ${routes.length} walkways; the operational limit is ${VENUE_MAP_MAX_ROUTES}.`);
  }
  if (drawings.length > VENUE_MAP_MAX_DRAWINGS) {
    issues.push(`The saved Venue Map contains ${drawings.length} shapes; the operational limit is ${VENUE_MAP_MAX_DRAWINGS}.`);
  }
  if (rainContingencies.length > VENUE_MAP_MAX_RAIN_CONTINGENCIES) {
    issues.push(`The saved Venue Map contains ${rainContingencies.length} rain plans; the operational limit is ${VENUE_MAP_MAX_RAIN_CONTINGENCIES}.`);
  }

  if (routes.length <= VENUE_MAP_MAX_ROUTES) {
    const overlongRoute = routes.find((candidate) => {
      const route = unknownRecord(candidate);
      return route && Array.isArray(route.pointIds)
        && route.pointIds.length > VENUE_MAP_MAX_ROUTE_POINTS;
    });
    const route = unknownRecord(overlongRoute);
    if (route && Array.isArray(route.pointIds)) {
      issues.push(`A saved walkway contains ${route.pointIds.length} ordered points; the per-walkway limit is ${VENUE_MAP_MAX_ROUTE_POINTS}.`);
    }
  }

  if (drawings.length <= VENUE_MAP_MAX_DRAWINGS) {
    const overlongLine = drawings.find((candidate) => {
      const drawing = unknownRecord(candidate);
      return drawing?.type === 'line'
        && Array.isArray(drawing.points)
        && drawing.points.length > VENUE_MAP_MAX_LINE_VERTICES;
    });
    const drawing = unknownRecord(overlongLine);
    if (drawing && Array.isArray(drawing.points)) {
      issues.push(`A saved line contains ${drawing.points.length} vertices; the per-line limit is ${VENUE_MAP_MAX_LINE_VERTICES}.`);
    }
  }

  // Collection-length failures already establish a quarantine. Avoid copying a
  // potentially hostile oversized document through TextEncoder merely to add a
  // redundant byte-size diagnostic.
  if (issues.length === 0) {
    const bytes = serializedVenueMapBytes(value);
    if (bytes > VENUE_MAP_MAX_SERIALIZED_BYTES) {
      issues.push(`The saved Venue Map is larger than the ${VENUE_MAP_MAX_SERIALIZED_BYTES / (1024 * 1024)} MiB canonical payload limit.`);
    }
  }
  return issues;
}

export function venueMapExceedsComplexityBudget(value: unknown): boolean {
  return venueMapComplexityIssues(value).length > 0;
}

function pointCoordinateFrameDimension(
  map: Pick<VenueMapConfig, 'width' | 'height'>,
  field: 'width' | 'height',
  legacyDefault: number,
): number | null {
  if (!Object.prototype.hasOwnProperty.call(map, field)) return legacyDefault;
  const value = map[field];
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= VENUE_MAP_FRAME_MIN
    && value <= VENUE_MAP_FRAME_MAX
    ? value
    : null;
}

/** Explain why a point cannot be located faithfully within its declared map frame. */
export function venueMapPointCoordinateIssue(
  point: Pick<VenueMapPoint, 'x' | 'y'>,
  map: Pick<VenueMapConfig, 'width' | 'height'>,
): string | null {
  const width = pointCoordinateFrameDimension(map, 'width', LEGACY_VENUE_MAP_WIDTH);
  const height = pointCoordinateFrameDimension(map, 'height', LEGACY_VENUE_MAP_HEIGHT);
  if (width === null || height === null) return 'The Venue Map frame is invalid.';
  if (typeof point.x !== 'number' || !Number.isFinite(point.x)) {
    return 'The point horizontal coordinate must be finite.';
  }
  if (typeof point.y !== 'number' || !Number.isFinite(point.y)) {
    return 'The point vertical coordinate must be finite.';
  }
  if (point.x < 0 || point.x > width) {
    return `The point horizontal coordinate must be from 0 to ${width}.`;
  }
  if (point.y < 0 || point.y > height) {
    return `The point vertical coordinate must be from 0 to ${height}.`;
  }
  return null;
}

const SUPPORTED_VENUE_MAP_DRAWING_TYPES = new Set([
  'zone',
  'rectangle',
  'circle',
  'line',
]);

/** Explain why a shape cannot be rendered and edited faithfully in venue maps. */
export function venueMapDrawingIntegrityIssue(drawing: DrawingObject): string | null {
  if (!SUPPORTED_VENUE_MAP_DRAWING_TYPES.has(drawing.type)) {
    return `Drawing type “${drawing.type || 'blank'}” is not supported by the Venue Map.`;
  }
  if (drawing.type === 'zone' || drawing.type === 'rectangle') {
    if (!Number.isFinite(drawing.x) || !Number.isFinite(drawing.y)) {
      return 'The rectangular shape does not have valid X and Y coordinates.';
    }
    if (
      !Number.isFinite(drawing.width)
      || !Number.isFinite(drawing.height)
      || drawing.width! <= 0
      || drawing.height! <= 0
    ) {
      return 'The rectangular shape needs a positive width and height.';
    }
    return null;
  }
  if (drawing.type === 'circle') {
    if (!Number.isFinite(drawing.x) || !Number.isFinite(drawing.y)) {
      return 'The circle does not have valid center coordinates.';
    }
    if (!Number.isFinite(drawing.radius) || drawing.radius! <= 0) {
      return 'The circle needs a positive radius.';
    }
    return null;
  }

  if (!Array.isArray(drawing.points) || drawing.points.length < 2) {
    return 'The line needs at least two valid vertices.';
  }
  if (drawing.points.some((point) =>
    !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) {
    return 'Every line vertex needs valid X and Y coordinates.';
  }
  const distinctVertices = new Set(
    drawing.points.map((point) => `${Object.is(point.x, -0) ? 0 : point.x}:${Object.is(point.y, -0) ? 0 : point.y}`),
  );
  return distinctVertices.size >= 2
    ? null
    : 'The line needs at least two different vertex positions.';
}

export interface VenueMapDrawingIntegrityPartition {
  map: VenueMapConfig;
  quarantinedDrawings: DrawingObject[];
}

/** Keep unsupported or malformed shapes recoverable while withholding them from portals. */
export function partitionVenueMapDrawingIntegrity(
  map: VenueMapConfig,
): VenueMapDrawingIntegrityPartition {
  const quarantinedIndexes = new Set((map.drawings || []).flatMap((drawing, index) =>
    venueMapDrawingIntegrityIssue(drawing) ? [index] : [],
  ));
  return {
    map: {
      ...map,
      drawings: (map.drawings || []).filter((_, index) => !quarantinedIndexes.has(index)),
    },
    quarantinedDrawings: (map.drawings || []).filter((_, index) => quarantinedIndexes.has(index)),
  };
}

export function venueMapHasInvalidDrawingGeometry(map: VenueMapConfig): boolean {
  return (map.drawings || []).some((drawing) => venueMapDrawingIntegrityIssue(drawing) !== null);
}

/** Keep every supported drawing geometry wholly inside the authored map. */
export function constrainMapDrawing(
  drawing: DrawingObject,
  mapWidth: number,
  mapHeight: number,
): DrawingObject {
  const widthLimit = Math.max(1, Number.isFinite(mapWidth) ? mapWidth : 1);
  const heightLimit = Math.max(1, Number.isFinite(mapHeight) ? mapHeight : 1);
  const width = drawing.width == null
    ? undefined
    : Math.max(1, Math.min(Number.isFinite(drawing.width) ? drawing.width : 1, widthLimit));
  const height = drawing.height == null
    ? undefined
    : Math.max(1, Math.min(Number.isFinite(drawing.height) ? drawing.height : 1, heightLimit));
  const radius = drawing.radius == null
    ? undefined
    : Math.max(1, Math.min(
        Number.isFinite(drawing.radius) ? drawing.radius : 1,
        Math.min(widthLimit, heightLimit) / 2,
      ));
  const rectangleLike = drawing.type === 'zone' || drawing.type === 'rectangle';
  const circleRadius = drawing.type === 'circle' ? radius : undefined;
  const minX = circleRadius ?? 0;
  const minY = circleRadius ?? 0;
  const maxX = circleRadius !== undefined
    ? widthLimit - circleRadius
    : rectangleLike && width !== undefined ? widthLimit - width : widthLimit;
  const maxY = circleRadius !== undefined
    ? heightLimit - circleRadius
    : rectangleLike && height !== undefined ? heightLimit - height : heightLimit;
  const clampBetween = (value: number, minimum: number, maximum: number) => {
    const finite = Number.isFinite(value) ? value : minimum;
    return Math.round(Math.max(minimum, Math.min(finite, maximum)) * 10) / 10;
  };

  return {
    ...drawing,
    x: clampBetween(drawing.x, minX, Math.max(minX, maxX)),
    y: clampBetween(drawing.y, minY, Math.max(minY, maxY)),
    width,
    height,
    radius,
    points: drawing.points?.map((point) => ({
      x: clampCoord(point.x, widthLimit),
      y: clampCoord(point.y, heightLimit),
    })),
  };
}

/** Resize the map canvas, clamping every point and drawing back into bounds. */
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
    drawings: map.drawings?.map((drawing) => constrainMapDrawing(drawing, w, h)),
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
    // Preserve ordered route references. The designer quarantines affected
    // routes for explicit replacement/rebuild rather than inventing a direct
    // segment between the deleted point's former neighbors.
    routes: map.routes || [],
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
    priority?: VenueMapRoutePriority;
    notes?: string;
    eventSpaceIds?: string[];
  } = {},
): VenueMapConfig {
  if ((map.routes || []).length >= VENUE_MAP_MAX_ROUTES) return map;
  const existing = new Set(map.points.map((point) => point.id));
  const validPointIds = pointIds.filter(
    (id, index) => existing.has(id) && pointIds.indexOf(id) === index,
  );
  if (validPointIds.length < 2 || validPointIds.length > VENUE_MAP_MAX_ROUTE_POINTS) return map;
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
        priority: options.priority || 'standard',
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
  patch: Partial<Pick<VenueMapRoute, 'name' | 'audience' | 'accessibility' | 'priority' | 'notes' | 'pointIds' | 'eventSpaceIds'>>,
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
  if (map.points.length >= VENUE_MAP_MAX_POINTS) return map;
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
  if (
    !map
    || venueMapRoutePriorityIssue(route)
    || route.pointIds.length < 2
    || venueMapRouteReferenceIssues(route, map.points).length > 0
  ) return [];
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
  if ((map.drawings || []).length >= VENUE_MAP_MAX_DRAWINGS) return map;
  if (drawing.type === 'line' && (drawing.points?.length || 0) > VENUE_MAP_MAX_LINE_VERTICES) return map;
  return {
    ...map,
    drawings: [
      ...(map.drawings || []),
      constrainMapDrawing(drawing, map.width, map.height),
    ],
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
      drawing.id === id
        ? constrainMapDrawing({ ...drawing, ...patch }, map.width, map.height)
        : drawing,
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
    drawings: [
      ...(map.drawings || []),
      ...presets.map((drawing) => constrainMapDrawing(drawing, map.width, map.height)),
    ],
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
    priority: normalizedRoutePriority(route.priority),
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
    backgroundImageUnavailable: source.backgroundImageUnavailable,
    updatedAt: source.updatedAt,
  };
}

/**
 * A safe, audience- and event-scoped projection for a map consumer. Projection
 * also rebuilds every object from an allowlist so undeclared/internal JSON fields
 * cannot leak merely because persisted input was structurally wider than its type.
 */
export type VenueMapIdentityFamily = 'point' | 'route' | 'drawing';
export type VenueMapIdentityObject = VenueMapPoint | VenueMapRoute | DrawingObject;

export interface VenueMapDuplicateIdentityGroup {
  family: VenueMapIdentityFamily;
  id: string;
  objects: VenueMapIdentityObject[];
}

export interface VenueMapIdentityPartition {
  /** Objects safe to render/edit while duplicated identities remain quarantined. */
  map: VenueMapConfig;
  duplicateGroups: VenueMapDuplicateIdentityGroup[];
  /** Unique routes hidden only because a referenced point identity is duplicated. */
  dependentRoutes: VenueMapRoute[];
}

function identityCounts(objects: Array<{ id: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const object of objects) counts.set(object.id, (counts.get(object.id) || 0) + 1);
  return counts;
}

/**
 * Quarantine every occurrence of an ambiguous identity. Routes that reference a
 * duplicated point are also withheld until an admin explicitly chooses which
 * point keeps the original route anchor.
 */
export function partitionVenueMapDuplicateIdentities(
  map: VenueMapConfig,
): VenueMapIdentityPartition {
  const pointCounts = identityCounts(map.points);
  const routeCounts = identityCounts(map.routes || []);
  const drawingCounts = identityCounts(map.drawings || []);
  const duplicatePointIds = new Set(
    [...pointCounts].filter(([, count]) => count > 1).map(([id]) => id),
  );
  const duplicateRouteIds = new Set(
    [...routeCounts].filter(([, count]) => count > 1).map(([id]) => id),
  );
  const duplicateDrawingIds = new Set(
    [...drawingCounts].filter(([, count]) => count > 1).map(([id]) => id),
  );
  const dependentRoutes = (map.routes || []).filter((route) =>
    !duplicateRouteIds.has(route.id)
      && route.pointIds.some((pointId) => duplicatePointIds.has(pointId)),
  );

  const duplicateGroups: VenueMapDuplicateIdentityGroup[] = [
    ...[...duplicatePointIds].map((id) => ({
      family: 'point' as const,
      id,
      objects: map.points.filter((point) => point.id === id),
    })),
    ...[...duplicateRouteIds].map((id) => ({
      family: 'route' as const,
      id,
      objects: (map.routes || []).filter((route) => route.id === id),
    })),
    ...[...duplicateDrawingIds].map((id) => ({
      family: 'drawing' as const,
      id,
      objects: (map.drawings || []).filter((drawing) => drawing.id === id),
    })),
  ];

  return {
    map: {
      ...map,
      points: map.points.filter((point) => !duplicatePointIds.has(point.id)),
      routes: (map.routes || []).filter((route) =>
        !duplicateRouteIds.has(route.id)
          && !route.pointIds.some((pointId) => duplicatePointIds.has(pointId)),
      ),
      drawings: (map.drawings || []).filter((drawing) =>
        !duplicateDrawingIds.has(drawing.id),
      ),
    },
    duplicateGroups,
    dependentRoutes,
  };
}

export function venueMapHasDuplicateIdentities(map: VenueMapConfig): boolean {
  return partitionVenueMapDuplicateIdentities(map).duplicateGroups.length > 0;
}

export type VenueMapRouteReferenceIssueReason =
  | 'malformed'
  | 'unavailable'
  | 'ambiguous'
  | 'duplicate';

export interface VenueMapRouteReferenceIssue {
  index: number;
  pointId: string;
  reason: VenueMapRouteReferenceIssueReason;
}

export function venueMapRouteReferenceIssues(
  route: VenueMapRoute,
  points: VenueMapPoint[],
): VenueMapRouteReferenceIssue[] {
  const pointCounts = identityCounts(points);
  const routeReferenceCounts = new Map<string, number>();
  for (const pointId of route.pointIds) {
    routeReferenceCounts.set(pointId, (routeReferenceCounts.get(pointId) || 0) + 1);
  }

  return route.pointIds.flatMap<VenueMapRouteReferenceIssue>((pointId, index) => {
    if (
      pointId === INVALID_VENUE_MAP_POINT_REFERENCE
      || typeof pointId !== 'string'
      || pointId.trim().length < 1
      || pointId.trim().length > 200
    ) {
      return [{ index, pointId, reason: 'malformed' as const }];
    }
    const matches = pointCounts.get(pointId) || 0;
    if (matches === 0) return [{ index, pointId, reason: 'unavailable' as const }];
    if (matches > 1) return [{ index, pointId, reason: 'ambiguous' as const }];
    if ((routeReferenceCounts.get(pointId) || 0) > 1) {
      return [{ index, pointId, reason: 'duplicate' as const }];
    }
    return [];
  });
}

export interface VenueMapRouteReferencePartition {
  map: VenueMapConfig;
  quarantinedRoutes: VenueMapRoute[];
}

/**
 * Withhold a whole route rather than connecting across a missing sequence item
 * or allowing an explicitly malformed priority to fail open as Standard.
 */
export function partitionVenueMapRouteReferenceIntegrity(
  map: VenueMapConfig,
): VenueMapRouteReferencePartition {
  const quarantinedRoutes = (map.routes || []).filter((route) =>
    venueMapRoutePriorityIssue(route) !== null
      || route.pointIds.length < 2
      || venueMapRouteReferenceIssues(route, map.points).length > 0,
  );
  const quarantinedIds = new Set(quarantinedRoutes.map((route) => route.id));
  return {
    map: {
      ...map,
      routes: (map.routes || []).filter((route) => !quarantinedIds.has(route.id)),
    },
    quarantinedRoutes,
  };
}

/** Portal-only catalog projection; canonical invalid pins remain admin-recoverable. */
export function projectVenueMapCurrentSpaceLinks(
  map: VenueMapConfig,
  venues: Venue[],
): VenueMapConfig {
  const pointCounts = identityCounts(map.points);
  const invalidPointIds = new Set(
    map.points
      .filter((point) =>
        pointCounts.get(point.id) === 1
          && venueMapSpacePointLinkIssue(point, venues) !== null,
      )
      .map((point) => point.id),
  );
  return {
    ...map,
    points: map.points.filter((point) => !invalidPointIds.has(point.id)),
    routes: (map.routes || []).filter((route) =>
      route.pointIds.every((pointId) => !invalidPointIds.has(pointId)),
    ),
  };
}

export function projectVenueMap(
  map: VenueMapConfig,
  viewer: VenueMapViewer,
  selectedVenueIds?: string[],
  options: { managedBaseImageOnly?: boolean; venues?: Venue[] } = {},
): VenueMapConfig {
  if (venueMapExceedsComplexityBudget(map)) {
    return projectedMap(
      {
        ...map,
        backgroundImageUrl: undefined,
        backgroundOpacity: undefined,
        backgroundImageUnavailable: Boolean(map.backgroundImageUrl) || undefined,
      },
      [],
      [],
      [],
      [],
    );
  }
  const duplicateIdentitySafeMap = partitionVenueMapDuplicateIdentities(map).map;
  const coordinateSafePointIds = new Set(
    duplicateIdentitySafeMap.points
      .filter((point) => venueMapPointCoordinateIssue(point, duplicateIdentitySafeMap) === null)
      .map((point) => point.id),
  );
  const coordinateSafeMap = {
    ...duplicateIdentitySafeMap,
    points: duplicateIdentitySafeMap.points.filter((point) => coordinateSafePointIds.has(point.id)),
    routes: (duplicateIdentitySafeMap.routes || []).filter((route) =>
      route.pointIds.every((pointId) => coordinateSafePointIds.has(pointId)),
    ),
  };
  const structurallySafeMap = partitionVenueMapRouteReferenceIntegrity(
    partitionVenueMapDrawingIntegrity(coordinateSafeMap).map,
  ).map;
  const catalogSafeMap = options.venues
    ? projectVenueMapCurrentSpaceLinks(structurallySafeMap, options.venues)
    : structurallySafeMap;
  const identitySafeMap = partitionVenueMapRainContingencyCollisions(catalogSafeMap).map;
  const managedImageUnavailable = options.managedBaseImageOnly
    && Boolean(identitySafeMap.backgroundImageUrl)
    && !isManagedVenueMapImageRef(identitySafeMap.backgroundImageUrl);
  const projectionSource = managedImageUnavailable
    ? {
        ...identitySafeMap,
        backgroundImageUrl: undefined,
        backgroundOpacity: undefined,
        backgroundImageUnavailable: true,
      }
    : identitySafeMap;
  const structurallyValidPortalContingencies = (identitySafeMap.rainContingencies || [])
    .filter((contingency) => contingency.outdoorVenueId !== contingency.indoorVenueId);
  const portalContingencies = options.venues
    ? structurallyValidPortalContingencies.filter(
        (contingency) => rainContingencyValidationIssue(contingency, options.venues!) === null,
      )
    : structurallyValidPortalContingencies;
  const audiencePoints = identitySafeMap.points.filter((point) =>
    isMapAudienceVisible(point.audience, viewer),
  );
  const audiencePointIds = new Set(audiencePoints.map((point) => point.id));
  const audienceRoutes = (identitySafeMap.routes || []).filter((route) =>
    isMapAudienceVisible(route.audience, viewer)
      && route.pointIds.length >= 2
      && route.pointIds.every((id) => audiencePointIds.has(id)),
  );

  if (selectedVenueIds === undefined && viewer !== 'guest') {
    return projectedMap(
      projectionSource,
      audiencePoints,
      audienceRoutes,
      (identitySafeMap.drawings || []).filter((drawing) =>
        isMapAudienceVisible(drawing.audience, viewer),
      ),
      portalContingencies,
    );
  }

  // A guest projection without an event context is not permission to expose
  // every event-scoped property layer. It receives only globally scoped,
  // non-space destinations until explicit event-space ids are supplied.
  const scopedVenueIds = selectedVenueIds || [];
  const backupIds = portalContingencies
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
    projectionSource,
    points,
    routes,
    (identitySafeMap.drawings || []).filter((drawing) =>
      isMapAudienceVisible(drawing.audience, viewer)
        && appliesToEvent(drawing.eventSpaceIds),
    ),
    portalContingencies.filter((contingency) =>
      scopedVenueIds.includes(contingency.outdoorVenueId),
    ),
  );
}

export interface VenueMapRoutePath {
  pointIds: string[];
  routes: VenueMapRoute[];
  /** Best venue-authored tier needed to connect the selected points. */
  priority: Exclude<VenueMapRoutePriority, 'emergency-only'> | 'emergency-only';
  /** Geometric length in authored map units (not a calibrated real-world distance). */
  distance: number;
}

const ROUTE_PRIORITY_RANK: Record<VenueMapRoutePriority, number> = {
  preferred: 0,
  standard: 1,
  secondary: 2,
  'emergency-only': 3,
};

function normalizedRoutePriority(priority: VenueMapRoutePriority | undefined): VenueMapRoutePriority {
  return priority && MAP_ROUTE_PRIORITIES.includes(priority) ? priority : 'standard';
}

/**
 * Find an authored path using the venue's priority before displayed distance.
 * We first try preferred routes only, then admit standard and secondary tiers in
 * order. Within the first tier that connects the destinations, Dijkstra chooses
 * the shortest geometric path. Emergency-only routes are excluded unless a
 * caller explicitly requests them; routine guest directions never do.
 */
export function findVenueMapRoute(
  map: VenueMapConfig,
  fromPointId: string,
  toPointId: string,
  options: { stepFreeOnly?: boolean; includeEmergencyOnly?: boolean } = {},
): VenueMapRoutePath | null {
  const pointsById = new Map(map.points.map((point) => [point.id, point]));
  if (!pointsById.has(fromPointId) || !pointsById.has(toPointId)) return null;
  if (fromPointId === toPointId) {
    return { pointIds: [fromPointId], routes: [], priority: 'standard', distance: 0 };
  }

  const tiers: VenueMapRoutePriority[] = options.includeEmergencyOnly
    ? ['preferred', 'standard', 'secondary', 'emergency-only']
    : ['preferred', 'standard', 'secondary'];
  const candidateRoutes = (map.routes || []).filter((route) =>
    venueMapRoutePriorityIssue(route) === null
      && (!options.stepFreeOnly || route.accessibility === 'step-free')
      && (options.includeEmergencyOnly || normalizedRoutePriority(route.priority) !== 'emergency-only')
      && route.pointIds.length >= 2
      && route.pointIds.every((id) => pointsById.has(id)),
  );

  for (const tier of tiers) {
    const maximumRank = ROUTE_PRIORITY_RANK[tier];
    const adjacency = new Map<string, Array<{
      pointId: string;
      route: VenueMapRoute;
      distance: number;
    }>>();
    for (const route of candidateRoutes) {
      if (ROUTE_PRIORITY_RANK[normalizedRoutePriority(route.priority)] > maximumRank) continue;
      for (let index = 1; index < route.pointIds.length; index += 1) {
        const from = route.pointIds[index - 1];
        const to = route.pointIds[index];
        const fromPoint = pointsById.get(from)!;
        const toPoint = pointsById.get(to)!;
        const distance = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
        if (!Number.isFinite(distance)) continue;
        adjacency.set(from, [...(adjacency.get(from) || []), { pointId: to, route, distance }]);
        adjacency.set(to, [...(adjacency.get(to) || []), { pointId: from, route, distance }]);
      }
    }
    adjacency.forEach((edges) => edges.sort((left, right) =>
      left.route.id.localeCompare(right.route.id) || left.pointId.localeCompare(right.pointId),
    ));

    const distances = new Map<string, number>([[fromPointId, 0]]);
    const signatures = new Map<string, string>([[fromPointId, fromPointId]]);
    const previous = new Map<string, { pointId: string; route: VenueMapRoute }>();
    const unvisited = new Set(pointsById.keys());
    const epsilon = 1e-9;

    while (unvisited.size > 0) {
      let current: string | null = null;
      for (const pointId of unvisited) {
        const candidateDistance = distances.get(pointId) ?? Number.POSITIVE_INFINITY;
        const currentDistance = current == null
          ? Number.POSITIVE_INFINITY
          : distances.get(current) ?? Number.POSITIVE_INFINITY;
        const candidateSignature = signatures.get(pointId) || pointId;
        const currentSignature = current == null ? '' : signatures.get(current) || current;
        if (
          candidateDistance < currentDistance - epsilon
          || (Math.abs(candidateDistance - currentDistance) <= epsilon
            && (current == null || candidateSignature < currentSignature))
        ) current = pointId;
      }
      if (current == null || !Number.isFinite(distances.get(current))) break;
      unvisited.delete(current);
      if (current === toPointId) break;

      for (const edge of adjacency.get(current) || []) {
        if (!unvisited.has(edge.pointId)) continue;
        const nextDistance = distances.get(current)! + edge.distance;
        const nextSignature = `${signatures.get(current) || current}>${edge.route.id}:${edge.pointId}`;
        const knownDistance = distances.get(edge.pointId) ?? Number.POSITIVE_INFINITY;
        const knownSignature = signatures.get(edge.pointId) || '';
        if (
          nextDistance < knownDistance - epsilon
          || (Math.abs(nextDistance - knownDistance) <= epsilon
            && (!knownSignature || nextSignature < knownSignature))
        ) {
          distances.set(edge.pointId, nextDistance);
          signatures.set(edge.pointId, nextSignature);
          previous.set(edge.pointId, { pointId: current, route: edge.route });
        }
      }
    }

    const distance = distances.get(toPointId);
    if (!Number.isFinite(distance)) continue;
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
      priority: tier,
      distance: distance!,
    };
  }

  return null;
}
