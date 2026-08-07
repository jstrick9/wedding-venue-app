import { describe, it, expect } from 'vitest';
import {
  addMapPoint, moveMapPoint, updateMapPoint, removeMapPoint,
  addMapRoute, removeMapRoute, renameMapRoute, routePoints, pointColor, updateMapSize,
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

  it('clamps size input to sane bounds and ignores non-finite values', () => {
    let map = updateMapSize(emptyVenueMapConfig(), 5, 9999); // below/above bounds
    expect(map.width).toBe(20);
    expect(map.height).toBe(500);
    map = updateMapSize(emptyVenueMapConfig(), NaN, 40);
    expect(map.width).toBe(100); // fallback to current width
    expect(map.height).toBe(40);
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
});
