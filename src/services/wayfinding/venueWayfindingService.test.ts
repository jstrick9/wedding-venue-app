import { describe, it, expect, beforeEach, vi } from 'vitest';
import { on } from '../../utils/appEvents';
import { projectVenueMap } from '../../utils/venueMapDesigner';
import {
  saveVenueMapConfig,
  getVenueMapConfig,
  saveVenueRules,
  getVenueRules,
  findRainContingency,
  coupleWayfindingPoints,
  routePolyline,
  emptyVenueMapConfig,
  normalizeVenueMapConfig,
} from './venueWayfindingService';

const map = {
  width: 100,
  height: 80,
  updatedAt: new Date().toISOString(),
  points: [
    { id: 'p1', label: 'Main Entry', kind: 'entry', x: 10, y: 10 },
    { id: 'p2', label: 'Parking', kind: 'parking', x: 20, y: 20 },
    { id: 'p3', label: 'Ceremony Garden', kind: 'space', venueId: 'ceremony', x: 30, y: 30 },
    { id: 'p4', label: 'Reception Hall', kind: 'space', venueId: 'reception', x: 60, y: 60 },
    { id: 'p5', label: 'Ballroom', kind: 'space', venueId: 'ballroom', x: 70, y: 70 },
    { id: 'p6', label: 'Restroom', kind: 'amenity', x: 90, y: 20 },
  ],
  rainContingencies: [
    { id: 'rc1', outdoorVenueId: 'ceremony', indoorVenueId: 'ballroom' },
  ],
  routes: [{ id: 'r1', name: 'Main Path', pointIds: ['p1', 'p3'] }],
};

describe('venueWayfindingService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and loads the venue map config', () => {
    expect(getVenueMapConfig()).toBeNull();
    saveVenueMapConfig(map as any);
    expect(getVenueMapConfig()!.points).toHaveLength(6);
  });

  it('emits one canonical persistence notification for a map save', async () => {
    const handler = vi.fn();
    const off = on('spm_data_changed', handler);

    saveVenueMapConfig(map as any);
    await Promise.resolve();
    off();

    const mapEvents = handler.mock.calls.filter(([detail]) => detail?.type === 'venueMapConfigs');
    expect(mapEvents).toHaveLength(1);
  });

  it('saves and loads venue rules', () => {
    saveVenueRules(['No open flames', 'Quiet after 10pm']);
    expect(getVenueRules().rules).toEqual(['No open flames', 'Quiet after 10pm']);
  });

  it('finds the rain contingency for an outdoor space', () => {
    const contingency = findRainContingency(map as any, 'ceremony');
    expect(contingency?.indoorVenueId).toBe('ballroom');
    expect(findRainContingency(map as any, 'reception')).toBeUndefined();
  });

  it('returns couple-scoped wayfinding points (selected spaces + parking/entry + backup)', () => {
    const points = coupleWayfindingPoints(map as any, ['ceremony', 'reception']);
    const labels = points.map((point) => point.label);
    expect(labels).toContain('Main Entry');
    expect(labels).toContain('Parking');
    expect(labels).toContain('Ceremony Garden');
    expect(labels).toContain('Reception Hall');
    expect(labels).toContain('Ballroom');
    expect(labels).toContain('Restroom');
    expect(points).toHaveLength(6);
  });

  it('includes couple-visible wayfinding without exposing staff-only points', () => {
    const scopedMap = {
      ...map,
      points: [
        ...map.points,
        { id: 'couple-suite', label: 'Planning Suite', kind: 'amenity', x: 15, y: 15, audience: 'couple', eventSpaceIds: ['ceremony'] },
        { id: 'staff-yard', label: 'Service Yard', kind: 'amenity', x: 16, y: 16, audience: 'staff' },
      ],
    };

    const labels = coupleWayfindingPoints(scopedMap as any, ['ceremony']).map((point) => point.label);
    expect(labels).toContain('Planning Suite');
    expect(labels).not.toContain('Service Yard');
  });

  it('returns no points when there is no map', () => {
    expect(coupleWayfindingPoints(null, ['ceremony'])).toHaveLength(0);
  });

  it('resolves a route polyline to ordered coordinates', () => {
    const polyline = routePolyline(map as any, 'r1');
    expect(polyline).toEqual([
      { x: 10, y: 10 },
      { x: 30, y: 30 },
    ]);
    expect(routePolyline(map as any, 'missing')).toHaveLength(0);
  });

  it('defaults empty map config to empty routes', () => {
    expect(emptyVenueMapConfig().routes).toEqual([]);
  });
});

describe('normalizeVenueMapConfig', () => {
  it('rejects non-object map payloads', () => {
    expect(normalizeVenueMapConfig(null)).toBeNull();
    expect(normalizeVenueMapConfig([])).toBeNull();
    expect(normalizeVenueMapConfig('map')).toBeNull();
  });

  it('rebuilds untrusted map JSON from an allowlist and clamps geometry', () => {
    const normalized = normalizeVenueMapConfig({
      width: 900,
      height: -20,
      backgroundImageUrl: 'javascript:alert(1)',
      backgroundOpacity: 99,
      internalVenueNotes: 'do not publish',
      points: [
        {
          id: 'gate',
          label: '  Main Gate  ',
          kind: 'entry',
          x: -5,
          y: 999,
          eventSpaceIds: ['ceremony', 'ceremony'],
          lat: 35.1,
          lng: 181,
          internalNotes: 'staff alarm code',
        },
        { id: 'garden', label: 'Garden', kind: 'space', x: 40, y: 15, venueId: 'ceremony' },
        { id: 'garden', label: 'Duplicate', kind: 'space', x: 1, y: 1 },
        { id: 'bad-kind', label: 'Bad', kind: 'secret', x: 1, y: 1 },
      ],
      routes: [
        {
          id: 'walk',
          name: '  Garden Walk ',
          pointIds: ['gate', 'garden', 'garden', 'missing'],
          accessibility: 'bogus',
          internalNotes: 'private route data',
        },
        { id: 'orphan', name: 'Orphan', pointIds: ['gate', 'missing'] },
      ],
      drawings: [
        {
          id: 'zone',
          type: 'zone',
          x: -1,
          y: 500,
          width: 800,
          height: 0,
          audience: 'staff',
          fillColor: 'url(https://tracker.example/pixel)',
          strokeColor: '#0f766e',
          points: [{ x: -20, y: 999 }],
          internalNotes: 'security perimeter details',
        },
      ],
      rainContingencies: [
        { id: 'rain', outdoorVenueId: 'ceremony', indoorVenueId: 'hall', note: '  Use hall. ' },
        { id: 'broken', outdoorVenueId: '', indoorVenueId: 'hall' },
      ],
      updatedAt: '2026-09-05T12:00:00.000Z',
    } as any);

    expect(normalized).not.toBeNull();
    expect(normalized).toMatchObject({
      width: 500,
      height: 20,
      backgroundImageUrl: undefined,
      backgroundOpacity: undefined,
      updatedAt: '2026-09-05T12:00:00.000Z',
    });
    expect(normalized?.points).toHaveLength(2);
    expect(normalized?.points[0]).toEqual({
      id: 'gate',
      label: 'Main Gate',
      description: undefined,
      x: 0,
      y: 20,
      kind: 'entry',
      audience: 'public',
      eventSpaceIds: ['ceremony'],
      venueId: undefined,
      lat: undefined,
      lng: undefined,
    });
    expect(normalized?.points[0]).not.toHaveProperty('internalNotes');
    expect(normalized?.routes).toEqual([
      expect.objectContaining({
        id: 'walk',
        name: 'Garden Walk',
        pointIds: ['gate', 'garden'],
        accessibility: 'unknown',
        audience: 'public',
      }),
    ]);
    expect(normalized?.routes[0]).not.toHaveProperty('internalNotes');
    expect(normalized?.drawings?.[0]).toMatchObject({
      id: 'zone',
      x: 0,
      y: 20,
      width: 500,
      height: 1,
      audience: 'staff',
      fillColor: undefined,
      strokeColor: '#0f766e',
      points: [{ x: 0, y: 20 }],
    });
    expect(normalized?.drawings?.[0]).not.toHaveProperty('internalNotes');
    expect(normalized?.rainContingencies).toEqual([
      { id: 'rain', outdoorVenueId: 'ceremony', indoorVenueId: 'hall', note: 'Use hall.' },
    ]);
    expect(normalized).not.toHaveProperty('internalVenueNotes');
  });

  it('fails closed for explicitly malformed audience and event-scope metadata', () => {
    const normalized = normalizeVenueMapConfig({
      width: 100,
      height: 80,
      points: [
        { id: 'legacy-missing', label: 'Legacy missing audience', kind: 'amenity', x: 0, y: 0 },
        { id: 'bad-audience', label: 'Bad audience', kind: 'amenity', x: 1, y: 1, audience: 'everyone' },
        { id: 'null-audience', label: 'Null audience', kind: 'amenity', x: 1, y: 2, audience: null },
        { id: 'blank-audience', label: 'Blank audience', kind: 'amenity', x: 1, y: 3, audience: '' },
        { id: 'null-scope', label: 'Null scope', kind: 'amenity', x: 2, y: 1, eventSpaceIds: null },
        { id: 'bad-scope', label: 'Bad scope', kind: 'amenity', x: 2, y: 2, eventSpaceIds: 'ceremony' },
      ],
      routes: [],
      rainContingencies: [],
    });

    expect(normalized?.points[0].audience).toBe('public');
    expect(normalized?.points.slice(1, 4).map((point) => point.audience)).toEqual([
      'staff',
      'staff',
      'staff',
    ]);
    expect(normalized?.points.slice(4, 6).map((point) => point.eventSpaceIds)).toEqual([
      ['__invalid_event_scope__'],
      ['__invalid_event_scope__'],
    ]);
    const projectedIds = projectVenueMap(
      normalized!,
      'guest',
      ['__invalid_event_scope__'],
    ).points.map((point) => point.id);
    expect(projectedIds).not.toContain('null-scope');
    expect(projectedIds).not.toContain('bad-scope');
  });

  it('keeps supported private, HTTPS, and inline raster background references', () => {
    const base = { width: 100, height: 80, points: [], routes: [], rainContingencies: [] };
    expect(normalizeVenueMapConfig({ ...base, backgroundImageUrl: 'sp://venue-map-images/org/map.png' })?.backgroundImageUrl)
      .toBe('sp://venue-map-images/org/map.png');
    expect(normalizeVenueMapConfig({ ...base, backgroundImageUrl: 'https://cdn.example/map.webp' })?.backgroundImageUrl)
      .toBe('https://cdn.example/map.webp');
    expect(normalizeVenueMapConfig({ ...base, backgroundImageUrl: 'data:image/png;base64,AA==' })?.backgroundImageUrl)
      .toBe('data:image/png;base64,AA==');
  });
});
