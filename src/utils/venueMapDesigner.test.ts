import { describe, it, expect } from 'vitest';
import {
  addMapDrawing, addMapPoint, moveMapPoint, updateMapDrawing, updateMapPoint, removeMapPoint,
  addMapRoute, removeMapRoute, renameMapRoute, duplicateMapPoint, routePoints, pointColor, updateMapSize,
  findVenueMapRoute, partitionVenueMapDrawingIntegrity, partitionVenueMapDuplicateIdentities,
  partitionVenueMapRainContingencyCollisions, partitionVenueMapRouteReferenceIntegrity,
  projectVenueMap, projectVenueMapCurrentSpaceLinks, rainContingencyCollisionIssues,
  rainContingencyValidationIssue,
  unavailableVenueMapEventScopeIds, updateMapRoute, venueMapDrawingIntegrityIssue,
  INVALID_VENUE_MAP_ROUTE_PRIORITY, venueMapEventScopeRecoveryLabel,
  venueMapHasInvalidDrawingGeometry, venueMapHasInvalidRoutePriorities,
  venueMapComplexityIssues, venueMapExceedsComplexityBudget,
  venueMapPointCoordinateIssue, venueMapRoutePriorityIssue,
  venueMapRouteReferenceIssues, venueMapSpacePointLinkIssue,
  VENUE_MAP_MAX_POINTS, VENUE_MAP_MAX_ROUTE_POINTS, VENUE_MAP_MAX_SERIALIZED_BYTES,
} from './venueMapDesigner';
import { emptyVenueMapConfig } from '../services/wayfinding/venueWayfindingService';

describe('venue map designer helpers', () => {
  it('adds a point clamped to bounds', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Grand Ballroom', kind: 'space', x: 200, y: -5, venueId: 'ballroom' });
    expect(map.points).toHaveLength(1);
    expect(map.points[0].x).toBe(100); // clamped to width 100
    expect(map.points[0].y).toBe(0);   // clamped to >= 0
    expect(map.points[0].kind).toBe('space');
  });

  it('enforces bounded whole-map and per-object complexity budgets', () => {
    const points = Array.from({ length: VENUE_MAP_MAX_POINTS }, (_, index) => ({
      id: `point-${index}`,
      label: `Point ${index}`,
      kind: 'entry' as const,
      x: index % 100,
      y: index % 80,
    }));
    const atLimit = { ...emptyVenueMapConfig(), points };
    expect(venueMapComplexityIssues(atLimit)).toEqual([]);
    expect(addMapPoint(atLimit, { label: 'Too many', kind: 'entry', x: 1, y: 1 })).toBe(atLimit);

    const overPointLimit = {
      ...atLimit,
      points: [...points, { id: 'point-over', label: 'Over', kind: 'entry' as const, x: 1, y: 1 }],
    };
    expect(venueMapComplexityIssues(overPointLimit))
      .toEqual([expect.stringMatching(/501 points.*limit is 500/i)]);
    expect(projectVenueMap(overPointLimit, 'couple').points).toEqual([]);

    expect(venueMapComplexityIssues({
      ...emptyVenueMapConfig(),
      routes: [{
        id: 'long-route',
        name: 'Long route',
        pointIds: Array.from({ length: VENUE_MAP_MAX_ROUTE_POINTS + 1 }, (_, index) => `point-${index}`),
      }],
    })).toEqual([expect.stringMatching(/101 ordered points.*limit is 100/i)]);

    expect(venueMapComplexityIssues({
      ...emptyVenueMapConfig(),
      drawings: [{
        id: 'long-line',
        type: 'line',
        points: Array.from({ length: 501 }, (_, index) => ({ x: index % 100, y: index % 80 })),
      }],
    })).toEqual([expect.stringMatching(/501 vertices.*limit is 500/i)]);

    expect(venueMapExceedsComplexityBudget({
      ...emptyVenueMapConfig(),
      unknownOversizedField: 'x'.repeat(VENUE_MAP_MAX_SERIALIZED_BYTES),
    })).toBe(true);
    expect(venueMapExceedsComplexityBudget('x'.repeat(VENUE_MAP_MAX_SERIALIZED_BYTES - 2)))
      .toBe(false);
    expect(venueMapExceedsComplexityBudget('x'.repeat(VENUE_MAP_MAX_SERIALIZED_BYTES)))
      .toBe(true);
    expect(venueMapExceedsComplexityBudget(null)).toBe(false);
    expect(venueMapExceedsComplexityBudget(undefined)).toBe(false);
  });

  it('moves a point (clamped) and updates metadata', () => {
    let map = addMapPoint(emptyVenueMapConfig(), { label: 'Parking A', kind: 'parking', x: 10, y: 10 });
    const id = map.points[0].id;
    map = moveMapPoint(map, id, 30, 40);
    expect(map.points[0].x).toBe(30);
    expect(map.points[0].y).toBe(40);
    map = updateMapPoint(map, id, { label: 'Parking A (West)', lat: 35.1, lng: -80.8 });
    expect(map.points[0].label).toBe('Parking A (West)');
    expect(map.points[0].lat).toBe(35.1);
  });

  it('removes a point without inventing a direct segment in dependent routes', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'A', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'B', kind: 'space', x: 20, y: 20 });
    map = addMapPoint(map, { label: 'C', kind: 'space', x: 40, y: 20 });
    const ids = map.points.map((p) => p.id);
    map = addMapRoute(map, 'Walkway', [ids[0], ids[1], ids[2]]);
    expect(map.routes).toHaveLength(1);
    map = removeMapPoint(map, ids[1]);
    expect(map.points).toHaveLength(2);
    expect(map.routes[0].pointIds).toEqual(ids);
    expect(partitionVenueMapRouteReferenceIntegrity(map).quarantinedRoutes)
      .toEqual(map.routes);
  });

  it('adds/removes routes and resolves their polyline coordinates', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Main Entry', kind: 'entry', x: 2, y: 2 });
    map = addMapPoint(map, { label: 'Ceremony', kind: 'space', x: 30, y: 20 });
    map = addMapPoint(map, { label: 'Reception', kind: 'space', x: 60, y: 20 });
    const ids = map.points.map((p) => p.id);
    map = addMapRoute(map, 'Main Walkway', ids);
    expect(map.routes).toHaveLength(1);
    const pts = routePoints(map, map.routes[0]);
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ x: 2, y: 2 });
    // Removing a route clears it.
    map = removeMapRoute(map, map.routes[0].id);
    expect(map.routes).toHaveLength(0);
  });

  it('exposes kind accent colors', () => {
    expect(pointColor('space')).toBe('#0d9488');
    expect(pointColor('parking')).toBe('#6366f1');
    expect(pointColor('path')).toBe('#94a3b8');
  });

  it('resizes the map and clamps points back into bounds', () => {
    let map = emptyVenueMapConfig(); // 100 x 80
    map = addMapPoint(map, { label: 'Ceremony', kind: 'space', x: 90, y: 75 });
    map = addMapPoint(map, { label: 'Parking', kind: 'parking', x: 5, y: 5 });
    // Shrink below existing points -> they clamp into the new bounds.
    map = updateMapSize(map, 50, 40);
    expect(map.width).toBe(50);
    expect(map.height).toBe(40);
    const ceremony = map.points.find((p) => p.label === 'Ceremony')!;
    expect(ceremony.x).toBe(50);
    expect(ceremony.y).toBe(40);
    // Grow keeps points where they are.
    map = updateMapSize(map, 200, 160);
    expect(map.width).toBe(200);
    expect(map.points.find((p) => p.label === 'Parking')!.x).toBe(5);
  });

  it('keeps vector zones inside resized map bounds', () => {
    const map = {
      ...emptyVenueMapConfig(),
      drawings: [{ id: 'zone', type: 'zone', x: 80, y: 70, width: 40, height: 30 }],
    };
    const resized = updateMapSize(map, 50, 40);
    expect(resized.drawings?.[0]).toMatchObject({ x: 10, y: 10, width: 40, height: 30 });
  });

  it('keeps zones and legacy circles wholly inside bounds during add and edit', () => {
    let map = addMapDrawing(emptyVenueMapConfig(), {
      id: 'zone',
      type: 'zone',
      x: 90,
      y: 70,
      width: 40,
      height: 30,
    });
    expect(map.drawings?.[0]).toMatchObject({ x: 60, y: 50, width: 40, height: 30 });

    map = updateMapDrawing(map, 'zone', { x: 95, y: 79 });
    expect(map.drawings?.[0]).toMatchObject({ x: 60, y: 50 });

    map = addMapDrawing(map, {
      id: 'circle',
      type: 'circle',
      x: 0,
      y: 80,
      radius: 20,
    });
    expect(map.drawings?.[1]).toMatchObject({ x: 20, y: 60, radius: 20 });
  });

  it('quarantines unsupported and malformed shapes while retaining all known valid geometry', () => {
    const validShapes = [
      { id: 'zone', type: 'zone', x: 1, y: 1, width: 10, height: 8 },
      { id: 'rectangle', type: 'rectangle', x: 2, y: 2, width: 4, height: 5 },
      { id: 'circle', type: 'circle', x: 20, y: 20, radius: 5 },
      { id: 'line', type: 'line', x: 0, y: 0, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
    ];
    const invalidShapes = [
      { id: 'unknown', type: 'polygon', x: 1, y: 1 },
      { id: 'widthless', type: 'zone', x: 1, y: 1 },
      { id: 'radiusless', type: 'circle', x: 5, y: 5 },
      { id: 'short-line', type: 'line', x: 0, y: 0, points: [{ x: 1, y: 1 }] },
      { id: 'zero-line', type: 'line', x: 0, y: 0, points: [{ x: 1, y: 1 }, { x: 1, y: 1 }] },
    ];
    const map = {
      ...emptyVenueMapConfig(),
      drawings: [...validShapes, ...invalidShapes],
    } as any;

    const partition = partitionVenueMapDrawingIntegrity(map);
    expect(partition.map.drawings?.map((drawing) => drawing.id)).toEqual(
      validShapes.map((drawing) => drawing.id),
    );
    expect(partition.quarantinedDrawings.map((drawing) => drawing.id)).toEqual(
      invalidShapes.map((drawing) => drawing.id),
    );
    expect(venueMapHasInvalidDrawingGeometry(map)).toBe(true);
    expect(venueMapDrawingIntegrityIssue(validShapes[3] as any)).toBeNull();
    expect(venueMapDrawingIntegrityIssue(invalidShapes[0] as any)).toMatch(/not supported/i);
    expect(venueMapDrawingIntegrityIssue(invalidShapes[4] as any)).toMatch(/different vertex/i);
    expect(projectVenueMap(map, 'guest').drawings?.map((drawing) => drawing.id)).toEqual(
      validShapes.map((drawing) => drawing.id),
    );
  });

  it('clamps size input to sane bounds and ignores non-finite values', () => {
    let map = updateMapSize(emptyVenueMapConfig(), 5, 9999); // below/above bounds
    expect(map.width).toBe(20);
    expect(map.height).toBe(500);
    map = updateMapSize(emptyVenueMapConfig(), NaN, 40);
    expect(map.width).toBe(100); // fallback to current width
    expect(map.height).toBe(40);
  });

  it('duplicates a point at a small offset, labeled "(copy)"', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Ceremony', kind: 'space', x: 30, y: 30, venueId: 'garden' });
    const id = map.points[0].id;
    map = duplicateMapPoint(map, id);
    expect(map.points).toHaveLength(2);
    const copy = map.points[1];
    expect(copy.label).toBe('Ceremony (copy)');
    expect(copy.x).toBeGreaterThan(30); // offset in +x
    expect(copy.y).toBeGreaterThan(30); // offset in +y
    expect(copy.id).not.toBe(id);
  });

  it('duplicate is clamped to bounds and does not copy route membership', () => {
    let map = emptyVenueMapConfig(); // 100 x 80
    map = addMapPoint(map, { label: 'Edge', kind: 'space', x: 95, y: 75 });
    map = addMapPoint(map, { label: 'Other', kind: 'entry', x: 5, y: 5 });
    map = addMapRoute(map, 'Walkway', map.points.map((p) => p.id));
    const id = map.points[0].id;
    map = duplicateMapPoint(map, id, 20);
    // The copy is the appended point.
    const copy = map.points[map.points.length - 1];
    expect(copy.label).toBe('Edge (copy)');
    expect(copy.x).toBe(100); // clamped to width
    expect(copy.y).toBe(80);  // clamped to height
    // The new point isn't in any route (route only references the two originals).
    expect(map.routes[0].pointIds).not.toContain(copy.id);
  });

  it('renames a route and keeps the existing name for a blank input', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'A', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'B', kind: 'space', x: 20, y: 20 });
    map = addMapRoute(map, 'Old Name', map.points.map((p) => p.id));
    const id = map.routes[0].id;
    map = renameMapRoute(map, id, 'Ceremony Walkway');
    expect(map.routes[0].name).toBe('Ceremony Walkway');
    // Blank keeps the current name.
    map = renameMapRoute(map, id, '   ');
    expect(map.routes[0].name).toBe('Ceremony Walkway');
  });

  it('quarantines every affected route regardless of how many other points remain', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'A', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'B', kind: 'space', x: 20, y: 20 });
    map = addMapPoint(map, { label: 'C', kind: 'space', x: 40, y: 20 });
    map = addMapRoute(map, 'Short', [map.points[0].id, map.points[1].id]); // 2 points
    map = addMapRoute(map, 'Long', map.points.map((p) => p.id)); // 3 points
    // Remove point B (shared by both routes).
    map = removeMapPoint(map, map.points[1].id);
    // Neither route is rewritten into a new direct connection.
    expect(map.routes.map((r) => r.name)).toEqual(['Short', 'Long']);
    expect(map.routes[0].pointIds).toHaveLength(2);
    expect(map.routes[1].pointIds).toHaveLength(3);
    expect(partitionVenueMapRouteReferenceIntegrity(map).quarantinedRoutes)
      .toEqual(map.routes);
  });

  it('rejects missing and duplicate point ids when adding a route', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'A', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'B', kind: 'space', x: 20, y: 20 });
    const [a, b] = map.points.map((point) => point.id);
    map = addMapRoute(map, 'Valid', [a, 'deleted-point', a, b]);
    expect(map.routes[0].pointIds).toEqual([a, b]);
    const unchanged = addMapRoute(map, 'Invalid', [a, 'deleted-point']);
    expect(unchanged).toBe(map);
  });

  it('updates route order safely and can clear event scope', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'A', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'B', kind: 'path', x: 20, y: 10 });
    map = addMapPoint(map, { label: 'C', kind: 'space', x: 40, y: 20, venueId: 'garden' });
    const [a, b, c] = map.points.map((point) => point.id);
    map = addMapRoute(map, 'Scoped', [a, b, c], { eventSpaceIds: ['garden'] });
    const routeId = map.routes[0].id;

    map = updateMapRoute(map, routeId, {
      pointIds: [c, 'missing', b, a, b],
      eventSpaceIds: undefined,
    });
    expect(map.routes[0].pointIds).toEqual([c, b, a]);
    expect(map.routes[0].eventSpaceIds).toBeUndefined();

    map = updateMapRoute(map, routeId, { pointIds: [a, 'missing'] });
    expect(map.routes[0].pointIds).toEqual([c, b, a]);
  });

  it('quarantines every duplicate identity and dependent route before portal projection', () => {
    const duplicateMap = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'dup-point', label: 'Public entrance', kind: 'entry', x: 5, y: 5, audience: 'public' },
        { id: 'dup-point', label: 'Staff entrance', kind: 'entry', x: 8, y: 8, audience: 'staff' },
        { id: 'destination', label: 'Garden', kind: 'space', venueId: 'garden', x: 40, y: 40, audience: 'public' },
      ],
      routes: [
        { id: 'dependent', name: 'Dependent path', pointIds: ['dup-point', 'destination'], audience: 'public' },
        { id: 'dup-route', name: 'First route', pointIds: ['dup-point', 'destination'], audience: 'public' },
        { id: 'dup-route', name: 'Second route', pointIds: ['dup-point', 'destination'], audience: 'staff' },
      ],
      drawings: [
        { id: 'dup-zone', type: 'zone', x: 1, y: 1, width: 5, height: 5, text: 'Guest zone', audience: 'public' },
        { id: 'dup-zone', type: 'zone', x: 2, y: 2, width: 5, height: 5, text: 'Staff zone', audience: 'staff' },
      ],
    } as any;

    const partition = partitionVenueMapDuplicateIdentities(duplicateMap);
    expect(partition.duplicateGroups.map((group) => [group.family, group.id, group.objects.length]))
      .toEqual([
        ['point', 'dup-point', 2],
        ['route', 'dup-route', 2],
        ['drawing', 'dup-zone', 2],
      ]);
    expect(partition.map.points.map((point) => point.id)).toEqual(['destination']);
    expect(partition.map.routes).toEqual([]);
    expect(partition.map.drawings).toEqual([]);
    expect(partition.dependentRoutes.map((route) => route.id)).toEqual(['dependent']);

    const projected = projectVenueMap(duplicateMap, 'couple');
    expect(projected.points.map((point) => point.id)).toEqual(['destination']);
    expect(projected.routes).toEqual([]);
    expect(projected.drawings).toEqual([]);
  });

  it('omits out-of-frame points and every dependent route from portal projections', () => {
    const coordinateMap = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'outside', label: 'Wrong gate', kind: 'entry', x: 101, y: 20 },
        { id: 'inside', label: 'Garden', kind: 'space', venueId: 'garden', x: 50, y: 40 },
      ],
      routes: [{
        id: 'dependent',
        name: 'Arrival path',
        pointIds: ['outside', 'inside'],
      }],
    } as any;

    expect(venueMapPointCoordinateIssue(coordinateMap.points[0], coordinateMap))
      .toMatch(/horizontal coordinate must be from 0 to 100/i);
    const projected = projectVenueMap(coordinateMap, 'couple');
    expect(projected.points.map((point) => point.id)).toEqual(['inside']);
    expect(projected.routes).toEqual([]);
  });

  it('counts duplicate point identities before coordinate filtering', () => {
    const duplicateMap = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'ambiguous', label: 'Inside twin', kind: 'entry', x: 5, y: 5 },
        { id: 'ambiguous', label: 'Outside twin', kind: 'entry', x: -5, y: 5 },
      ],
      routes: [],
    } as any;

    expect(projectVenueMap(duplicateMap, 'couple').points).toEqual([]);
  });

  it('quarantines a whole walkway instead of connecting across a missing point', () => {
    const brokenMap = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'parking', label: 'Parking', kind: 'parking', x: 5, y: 5 },
        { id: 'ceremony', label: 'Ceremony', kind: 'space', venueId: 'garden', x: 50, y: 40 },
      ],
      routes: [{
        id: 'broken-route',
        name: 'Arrival path',
        pointIds: ['parking', 'deleted-checkpoint', 'ceremony'],
      }],
    } as any;

    expect(venueMapRouteReferenceIssues(brokenMap.routes[0], brokenMap.points)).toEqual([{
      index: 1,
      pointId: 'deleted-checkpoint',
      reason: 'unavailable',
    }]);
    const partition = partitionVenueMapRouteReferenceIntegrity(brokenMap);
    expect(partition.map.routes).toEqual([]);
    expect(partition.quarantinedRoutes).toEqual(brokenMap.routes);
    expect(routePoints(brokenMap, brokenMap.routes[0])).toEqual([]);
    expect(projectVenueMap(brokenMap, 'couple').routes).toEqual([]);
  });

  it('quarantines explicit invalid priorities while preserving omitted legacy priorities as Standard', () => {
    const map = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'gate', label: 'Gate', kind: 'entry' as const, x: 5, y: 5 },
        { id: 'lawn', label: 'Lawn', kind: 'space' as const, venueId: 'garden', x: 50, y: 40 },
      ],
      routes: [
        {
          id: 'damaged-emergency-route',
          name: 'Damaged emergency route',
          pointIds: ['gate', 'lawn'],
          priority: INVALID_VENUE_MAP_ROUTE_PRIORITY,
        },
        {
          id: 'legacy-route',
          name: 'Legacy route',
          pointIds: ['gate', 'lawn'],
        },
      ],
    };

    expect(venueMapRoutePriorityIssue(map.routes[0])).toMatch(/invalid/i);
    expect(venueMapRoutePriorityIssue(map.routes[1])).toBeNull();
    expect(venueMapHasInvalidRoutePriorities(map)).toBe(true);
    const partition = partitionVenueMapRouteReferenceIntegrity(map);
    expect(partition.quarantinedRoutes.map((route) => route.id))
      .toEqual(['damaged-emergency-route']);
    expect(partition.map.routes.map((route) => route.id)).toEqual(['legacy-route']);
    expect(routePoints(map, map.routes[0])).toEqual([]);
    expect(projectVenueMap(map, 'guest', ['garden']).routes).toEqual([
      expect.objectContaining({ id: 'legacy-route', priority: 'standard' }),
    ]);
    expect(findVenueMapRoute({ ...map, routes: [map.routes[0]] }, 'gate', 'lawn'))
      .toBeNull();
    expect(findVenueMapRoute({ ...map, routes: [map.routes[1]] }, 'gate', 'lawn'))
      .toMatchObject({ priority: 'standard' });
  });

  it('projects guest, couple, and staff audiences without orphan route shortcuts', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Gate', kind: 'entry', x: 5, y: 5, audience: 'public' });
    map = addMapPoint(map, { label: 'Ceremony', kind: 'space', x: 40, y: 20, venueId: 'ceremony', audience: 'public' });
    map = addMapPoint(map, { label: 'Planning Suite', kind: 'space', x: 50, y: 30, venueId: 'suite', audience: 'couple' });
    map = addMapPoint(map, { label: 'Service Yard', kind: 'space', x: 60, y: 40, venueId: 'service', audience: 'staff' });
    const [gate, ceremony, suite, service] = map.points.map((point) => point.id);
    map = addMapRoute(map, 'Guest Walk', [gate, ceremony], { audience: 'public', accessibility: 'step-free' });
    map = addMapRoute(map, 'Service Road', [gate, service], { audience: 'staff' });
    map = addMapRoute(map, 'Hidden shortcut', [gate, service, ceremony], { audience: 'public' });
    map = addMapRoute(map, 'Couple Walk', [gate, suite], { audience: 'couple' });

    const guest = projectVenueMap(map, 'guest', ['ceremony']);
    expect(guest.points.map((point) => point.label)).toEqual(['Gate', 'Ceremony']);
    expect(guest.routes.map((route) => route.name)).toEqual(['Guest Walk']);

    const couple = projectVenueMap(map, 'couple');
    expect(couple.points.map((point) => point.label)).toContain('Planning Suite');
    expect(couple.points.map((point) => point.label)).not.toContain('Service Yard');
    expect(couple.routes.map((route) => route.name)).toContain('Couple Walk');

    const staff = projectVenueMap(map, 'staff');
    expect(staff.points.map((point) => point.label)).toContain('Service Yard');
  });

  it('quarantines every rain plan in duplicate-ID or competing-source collision components', () => {
    const map = {
      ...emptyVenueMapConfig(),
      rainContingencies: [
        { id: 'duplicate-id', outdoorVenueId: 'lawn', indoorVenueId: 'hall' },
        { id: 'duplicate-id', outdoorVenueId: 'terrace', indoorVenueId: 'barn' },
        { id: 'third-plan', outdoorVenueId: 'terrace', indoorVenueId: 'hall' },
        { id: 'safe-plan', outdoorVenueId: 'courtyard', indoorVenueId: 'barn' },
      ],
    };

    expect(rainContingencyCollisionIssues(
      map.rainContingencies[0],
      map.rainContingencies,
    )).toEqual(['Plan ID “duplicate-id” is duplicated.']);
    expect(rainContingencyCollisionIssues(
      map.rainContingencies[1],
      map.rainContingencies,
    )).toEqual([
      'Plan ID “duplicate-id” is duplicated.',
      'Outdoor space “terrace” has competing rain plans.',
    ]);

    const partition = partitionVenueMapRainContingencyCollisions(map);
    expect(partition.map.rainContingencies.map((plan) => plan.id)).toEqual(['safe-plan']);
    expect(partition.quarantinedContingencies.map((plan) => plan.id)).toEqual([
      'duplicate-id',
      'duplicate-id',
      'third-plan',
    ]);
    expect(partition.collisionGroups).toHaveLength(1);
    expect(partition.collisionGroups[0]).toMatchObject({
      duplicatedIds: ['duplicate-id'],
      duplicatedOutdoorVenueIds: ['terrace'],
    });
    expect(projectVenueMap(map, 'couple').rainContingencies.map((plan) => plan.id))
      .toEqual(['safe-plan']);
  });

  it('validates current rain-space roles and excludes stale pairs before portal scope expansion', () => {
    const venues = [
      { id: 'lawn', name: 'Ceremony Lawn', category: 'ceremony', environment: 'outdoor' },
      { id: 'hall', name: 'Main Hall', category: 'reception', environment: 'indoor' },
      { id: 'terrace', name: 'Terrace', category: 'reception', environment: 'outdoor' },
    ] as any;
    expect(rainContingencyValidationIssue(
      { id: 'valid', outdoorVenueId: 'lawn', indoorVenueId: 'hall' },
      venues,
    )).toBeNull();
    expect(rainContingencyValidationIssue(
      { id: 'missing', outdoorVenueId: 'removed-space', indoorVenueId: 'hall' },
      venues,
    )).toMatch(/no longer exists/i);
    expect(rainContingencyValidationIssue(
      { id: 'wrong-role', outdoorVenueId: 'lawn', indoorVenueId: 'terrace' },
      venues,
    )).toMatch(/no longer marked indoor/i);

    const map = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'lawn-pin', label: 'Lawn', kind: 'space', venueId: 'lawn', x: 10, y: 10 },
        { id: 'hall-pin', label: 'Hall', kind: 'space', venueId: 'hall', x: 20, y: 20 },
        { id: 'terrace-pin', label: 'Terrace', kind: 'space', venueId: 'terrace', x: 30, y: 30 },
      ],
      rainContingencies: [
        { id: 'valid', outdoorVenueId: 'lawn', indoorVenueId: 'hall' },
        { id: 'invalid', outdoorVenueId: 'terrace', indoorVenueId: 'lawn' },
      ],
    } as any;
    const guest = projectVenueMap(map, 'guest', ['lawn'], { venues });
    expect(guest.rainContingencies).toEqual([
      { id: 'valid', outdoorVenueId: 'lawn', indoorVenueId: 'hall', note: undefined },
    ]);
    expect(guest.points.map((point) => point.venueId)).toEqual(['lawn', 'hall']);
  });

  it('fails portal projections closed for missing, stale, or ambiguous space-pin links and dependent routes', () => {
    const venues = [
      { id: 'garden', name: 'Garden' },
      { id: 'ballroom', name: 'Ballroom' },
      { id: 'duplicate', name: 'Duplicate A' },
      { id: 'duplicate', name: 'Duplicate B' },
    ] as any;
    const map = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'gate', label: 'Gate', kind: 'entry', x: 1, y: 1 },
        { id: 'valid', label: 'Garden', kind: 'space', venueId: 'garden', x: 10, y: 10 },
        { id: 'missing', label: 'Unlinked', kind: 'space', x: 20, y: 20 },
        { id: 'stale', label: 'Deleted hall', kind: 'space', venueId: 'deleted', x: 30, y: 30 },
        { id: 'ambiguous', label: 'Ambiguous hall', kind: 'space', venueId: 'duplicate', x: 40, y: 40 },
        { id: 'reclassified', label: 'Former space', kind: 'amenity', venueId: 'deleted', x: 50, y: 50 },
      ],
      routes: [
        { id: 'valid-route', name: 'Garden route', pointIds: ['gate', 'valid'] },
        { id: 'missing-route', name: 'Unlinked route', pointIds: ['gate', 'missing'] },
        { id: 'stale-route', name: 'Deleted route', pointIds: ['gate', 'stale'] },
        { id: 'ambiguous-route', name: 'Ambiguous route', pointIds: ['gate', 'ambiguous'] },
      ],
    } as any;

    expect(venueMapSpacePointLinkIssue(map.points[1], venues)).toBeNull();
    expect(venueMapSpacePointLinkIssue(map.points[2], venues)).toMatch(/not linked/i);
    expect(venueMapSpacePointLinkIssue(map.points[3], venues)).toMatch(/no longer exists/i);
    expect(venueMapSpacePointLinkIssue(map.points[4], venues)).toMatch(/not unique/i);
    expect(venueMapSpacePointLinkIssue(map.points[5], venues)).toBeNull();

    const catalogSafe = projectVenueMapCurrentSpaceLinks(map, venues);
    expect(catalogSafe.points.map((point) => point.id)).toEqual(['gate', 'valid', 'reclassified']);
    expect(catalogSafe.routes.map((route) => route.id)).toEqual(['valid-route']);

    const couple = projectVenueMap(map, 'couple', undefined, { venues });
    expect(couple.points.map((point) => point.id)).toEqual(['gate', 'valid', 'reclassified']);
    expect(couple.routes.map((route) => route.id)).toEqual(['valid-route']);

    const guest = projectVenueMap(map, 'guest', ['garden'], { venues });
    expect(guest.points.map((point) => point.id)).toEqual(['gate', 'valid', 'reclassified']);
    expect(guest.routes.map((route) => route.id)).toEqual(['valid-route']);
  });

  it('rejects duplicate space identities before catalog filtering can make one appear canonical', () => {
    const map = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'gate', label: 'Gate', kind: 'entry', x: 1, y: 1 },
        { id: 'same', label: 'Current', kind: 'space', venueId: 'garden', x: 10, y: 10 },
        { id: 'same', label: 'Stale', kind: 'space', venueId: 'deleted', x: 20, y: 20 },
      ],
      routes: [{ id: 'route', name: 'Route', pointIds: ['gate', 'same'] }],
    } as any;
    const projected = projectVenueMap(map, 'couple', undefined, {
      venues: [{ id: 'garden', name: 'Garden' }] as any,
    });
    expect(projected.points.map((point) => point.id)).toEqual(['gate']);
    expect(projected.routes).toEqual([]);
  });

  it('identifies stale and malformed event scopes without changing valid selections', () => {
    const venues = [
      { id: 'garden', name: 'Garden' },
      { id: 'ballroom', name: 'Ballroom' },
    ] as any;
    expect(unavailableVenueMapEventScopeIds(
      ['garden', 'deleted-space', '__invalid_event_scope__'],
      venues,
    )).toEqual(['deleted-space', '__invalid_event_scope__']);
    expect(venueMapEventScopeRecoveryLabel('__invalid_event_scope__'))
      .toBe('Malformed saved scope');
    expect(venueMapEventScopeRecoveryLabel('deleted-space')).toBe('deleted-space');
    expect(unavailableVenueMapEventScopeIds(
      ['garden'],
      [...venues, { id: 'garden', name: 'Duplicate Garden' }] as any,
    )).toEqual(['garden']);
  });

  it('fails closed when persisted audience or event scope is explicitly malformed', () => {
    const malformedAudienceMap = {
      ...emptyVenueMapConfig(),
      points: [{ id: 'private', label: 'Private', kind: 'amenity', x: 1, y: 1, audience: 'everyone' }],
    } as any;
    expect(projectVenueMap(malformedAudienceMap, 'guest').points).toEqual([]);
    expect(projectVenueMap(malformedAudienceMap, 'couple').points).toEqual([]);
    expect(projectVenueMap(malformedAudienceMap, 'staff').points).toHaveLength(1);
    for (const malformedAudience of [null, '']) {
      const map = {
        ...emptyVenueMapConfig(),
        points: [{ id: 'private', label: 'Private', kind: 'amenity', x: 1, y: 1, audience: malformedAudience }],
      } as any;
      expect(projectVenueMap(map, 'guest').points).toEqual([]);
      expect(projectVenueMap(map, 'couple').points).toEqual([]);
    }

    const malformedScopeMap = {
      ...emptyVenueMapConfig(),
      points: [{ id: 'bad-scope', label: 'Bad scope', kind: 'amenity', x: 1, y: 1, eventSpaceIds: 'ceremony' }],
    } as any;
    expect(projectVenueMap(malformedScopeMap, 'guest', ['ceremony']).points).toEqual([]);
  });

  it('allowlists projection fields instead of leaking structurally wider JSON', () => {
    const map = {
      width: 100,
      height: 80,
      points: [
        { id: 'gate', label: 'Gate', kind: 'entry', x: 5, y: 5, internalNotes: 'gate code 1234' },
        { id: 'garden', label: 'Garden', kind: 'space', venueId: 'ceremony', x: 40, y: 20 },
      ],
      routes: [{ id: 'walk', name: 'Walk', pointIds: ['gate', 'garden'], internalNotes: 'staff shortcut' }],
      drawings: [{ id: 'zone', type: 'zone', x: 1, y: 1, width: 4, height: 4, internalNotes: 'alarm location' }],
      rainContingencies: [],
      updatedAt: '2026-09-05T12:00:00.000Z',
      internalVenueNotes: 'private operations details',
    } as any;

    const guest = projectVenueMap(map, 'guest', ['ceremony']);
    expect(JSON.stringify(guest)).not.toContain('internal');
    expect(JSON.stringify(guest)).not.toContain('1234');
    expect(guest.points[0]).not.toHaveProperty('internalNotes');
    expect(guest.routes[0]).not.toHaveProperty('internalNotes');
    expect(guest.drawings?.[0]).not.toHaveProperty('internalNotes');
    expect(guest).not.toHaveProperty('internalVenueNotes');
    expect(guest.routes[0].pointIds).not.toBe(map.routes[0].pointIds);
  });

  it('applies event-space scope to points, routes, and zones', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Main Gate', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'Ceremony Lawn', kind: 'space', x: 30, y: 20, venueId: 'ceremony' });
    map = addMapPoint(map, { label: 'Reception Hall', kind: 'space', x: 70, y: 20, venueId: 'reception' });
    map = addMapPoint(map, { label: 'Ceremony Restroom', kind: 'amenity', x: 25, y: 15, eventSpaceIds: ['ceremony'] });
    map = addMapPoint(map, { label: 'Reception Bar', kind: 'amenity', x: 75, y: 15, eventSpaceIds: ['reception'] });
    const [gate, ceremony, reception, ceremonyAmenity, receptionAmenity] = map.points.map((point) => point.id);
    map = addMapRoute(map, 'Ceremony route', [gate, ceremonyAmenity, ceremony], { eventSpaceIds: ['ceremony'] });
    map = addMapRoute(map, 'Reception route', [gate, receptionAmenity, reception], { eventSpaceIds: ['reception'] });
    map = {
      ...map,
      drawings: [
        { id: 'ceremony-zone', type: 'zone', x: 10, y: 10, width: 20, height: 20, eventSpaceIds: ['ceremony'] },
        { id: 'reception-zone', type: 'zone', x: 60, y: 10, width: 20, height: 20, eventSpaceIds: ['reception'] },
        { id: 'global-zone', type: 'zone', x: 0, y: 0, width: 5, height: 5 },
      ],
    };

    const ceremonyMap = projectVenueMap(map, 'guest', ['ceremony']);
    expect(ceremonyMap.points.map((point) => point.label)).toEqual([
      'Main Gate',
      'Ceremony Lawn',
      'Ceremony Restroom',
    ]);
    expect(ceremonyMap.routes.map((route) => route.name)).toEqual(['Ceremony route']);
    expect(ceremonyMap.drawings?.map((drawing) => drawing.id)).toEqual(['ceremony-zone', 'global-zone']);

    const noEventContext = projectVenueMap(map, 'guest');
    expect(noEventContext.points.map((point) => point.label)).toEqual(['Main Gate']);
    expect(noEventContext.routes).toEqual([]);
    expect(noEventContext.drawings?.map((drawing) => drawing.id)).toEqual(['global-zone']);
  });

  it('finds only authored graph paths and can require verified step-free routes', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Parking', kind: 'parking', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'Junction', kind: 'path', x: 20, y: 10 });
    map = addMapPoint(map, { label: 'Ceremony', kind: 'space', x: 40, y: 20 });
    map = addMapPoint(map, { label: 'Unconnected', kind: 'amenity', x: 80, y: 70 });
    const [parking, junction, ceremony, unconnected] = map.points.map((point) => point.id);
    map = addMapRoute(map, 'Parking Path', [parking, junction], { accessibility: 'step-free' });
    map = addMapRoute(map, 'Garden Path', [junction, ceremony], { accessibility: 'step-free', notes: 'Use the ramp.' });

    const route = findVenueMapRoute(map, parking, ceremony, { stepFreeOnly: true });
    expect(route?.pointIds).toEqual([parking, junction, ceremony]);
    expect(route?.routes.map((item) => item.name)).toEqual(['Parking Path', 'Garden Path']);
    expect(findVenueMapRoute(map, parking, unconnected)).toBeNull();
  });

  it('uses venue priority before geometric distance and distance instead of authored segment count', () => {
    const base = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'start', label: 'Start', kind: 'entry' as const, x: 0, y: 0 },
        { id: 'far', label: 'Far bend', kind: 'path' as const, x: 5, y: 20 },
        { id: 'near-1', label: 'Near one', kind: 'path' as const, x: 3, y: 0 },
        { id: 'near-2', label: 'Near two', kind: 'path' as const, x: 7, y: 0 },
        { id: 'end', label: 'End', kind: 'space' as const, x: 10, y: 0 },
      ],
      routes: [
        { id: 'short-standard', name: 'Short standard', pointIds: ['start', 'near-1', 'near-2', 'end'], priority: 'standard' as const },
        { id: 'long-standard', name: 'Long standard', pointIds: ['start', 'far', 'end'], priority: 'standard' as const },
      ],
    };

    const shortest = findVenueMapRoute(base, 'start', 'end');
    expect(shortest?.pointIds).toEqual(['start', 'near-1', 'near-2', 'end']);
    expect(shortest?.distance).toBe(10);
    expect(shortest?.priority).toBe('standard');

    const preferred = {
      ...base,
      routes: base.routes.map((route) => route.id === 'long-standard'
        ? { ...route, priority: 'preferred' as const }
        : route),
    };
    expect(findVenueMapRoute(preferred, 'start', 'end')?.pointIds)
      .toEqual(['start', 'far', 'end']);
    expect(findVenueMapRoute(preferred, 'start', 'end')?.priority).toBe('preferred');
  });

  it('excludes emergency-only paths from routine directions and validates identical endpoints', () => {
    const map = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'start', label: 'Start', kind: 'entry' as const, x: 0, y: 0 },
        { id: 'end', label: 'End', kind: 'space' as const, x: 10, y: 0 },
      ],
      routes: [{
        id: 'evacuation',
        name: 'Evacuation Route',
        pointIds: ['start', 'end'],
        priority: 'emergency-only' as const,
        accessibility: 'step-free' as const,
      }],
    };

    expect(findVenueMapRoute(map, 'start', 'end')).toBeNull();
    expect(findVenueMapRoute(map, 'start', 'end', { includeEmergencyOnly: true }))
      .toMatchObject({ pointIds: ['start', 'end'], priority: 'emergency-only', distance: 10 });
    expect(findVenueMapRoute(map, 'missing', 'missing')).toBeNull();
  });
});
