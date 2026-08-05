import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveVenueMapConfig,
  getVenueMapConfig,
  saveVenueRules,
  getVenueRules,
  findRainContingency,
  coupleWayfindingPoints,
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

  it('saves and loads venue rules', () => {
    saveVenueRules(['No open flames', 'Quiet after 10pm']);
    expect(getVenueRules().rules).toEqual(['No open flames', 'Quiet after 10pm']);
  });

  it('finds the rain contingency for an outdoor space', () => {
    const c = findRainContingency(map as any, 'ceremony');
    expect(c?.indoorVenueId).toBe('ballroom');
    expect(findRainContingency(map as any, 'reception')).toBeUndefined();
  });

  it('returns couple-scoped wayfinding points (selected spaces + parking/entry + backup)', () => {
    const pts = coupleWayfindingPoints(map as any, ['ceremony', 'reception']);
    const labels = pts.map((p) => p.label);
    expect(labels).toContain('Main Entry');
    expect(labels).toContain('Parking');
    expect(labels).toContain('Ceremony Garden');
    expect(labels).toContain('Reception Hall');
    // rain-contingency backup surfaced
    expect(labels).toContain('Ballroom');
    // restroom amenity surfaced
    expect(labels).toContain('Restroom');
    expect(pts).toHaveLength(6);
  });

  it('returns no points when there is no map', () => {
    expect(coupleWayfindingPoints(null, ['ceremony'])).toHaveLength(0);
  });
});
