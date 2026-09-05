import { describe, it, expect } from 'vitest';
import {
  addMapPoint, moveMapPoint, updateMapPoint, removeMapPoint,
  addMapRoute, removeMapRoute, renameMapRoute, duplicateMapPoint, routePoints, pointColor, updateMapSize,
  findVenueMapRoute, projectVenueMap, updateMapRoute,
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

  it('removes a point and prunes it from routes', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'A', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'B', kind: 'space', x: 20, y: 20 });
    map = addMapPoint(map, { label: 'C', kind: 'space', x: 40, y: 20 });
    const ids = map.points.map((p) => p.id);
    map = addMapRoute(map, 'Walkway', [ids[0], ids[1], ids[2]]);
    expect(map.routes).toHaveLength(1);
    map = removeMapPoint(map, ids[1]);
    expect(map.points).toHaveLength(2);
    expect(map.routes[0].pointIds).toEqual([ids[0], ids[2]]);
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

  it('drops a route entirely when removing a point leaves fewer than 2 points', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'A', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'B', kind: 'space', x: 20, y: 20 });
    map = addMapPoint(map, { label: 'C', kind: 'space', x: 40, y: 20 });
    map = addMapRoute(map, 'Short', [map.points[0].id, map.points[1].id]); // 2 points
    map = addMapRoute(map, 'Long', map.points.map((p) => p.id)); // 3 points
    // Remove point B (shared by both routes).
    map = removeMapPoint(map, map.points[1].id);
    // 'Short' drops below 2 -> removed; 'Long' keeps 2 -> retained.
    expect(map.routes.map((r) => r.name)).toEqual(['Long']);
    expect(map.routes[0].pointIds).toHaveLength(2);
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
});
