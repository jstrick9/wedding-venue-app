import { beforeEach, describe, expect, it } from 'vitest';
import {
  getVenues,
  setVenues,
  getTableSpecs,
  setTableSpecs,
  getFixtureTypes,
  setFixtureTypes,
  getTemplates,
  setTemplates,
  getGuidelines,
  setGuidelines,
} from './useLayoutState';

/**
 * Venue-admin persona: as a venue admin I set up the catalog (spaces, tables,
 * fixtures, templates) so couples can design layouts. This exercises the real
 * service layer the admin panels call, catching data-flow gaps.
 */
describe('venue admin catalog setup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates venue spaces and reads them back with capacity', () => {
    const venues = [
      { id: 'ballroom', name: 'Grand Ballroom', width: 80, height: 60, capacity: 250, category: 'reception', color: '#fff' },
      { id: 'garden', name: 'Garden', width: 100, height: 80, capacity: 150, category: 'outdoor', color: '#eee' },
    ];
    setVenues(venues as any);
    expect(getVenues()).toHaveLength(2);
    expect(getVenues().find((v) => v.id === 'ballroom')?.capacity).toBe(250);
    // Master layout defaults to undefined until saved.
    expect(getVenues().find((v) => v.id === 'garden')?.masterLayout).toBeUndefined();
  });

  it('creates table specs with capacity and reads them back', () => {
    setTableSpecs([
      { id: 'round-60', name: 'Round 60"', shape: 'circle', width: 5, height: 5, capacity: 8 },
      { id: 'rect-8', name: 'Rect 8ft', shape: 'rectangle', width: 8, height: 3, capacity: 8 },
    ] as any);
    expect(getTableSpecs()).toHaveLength(2);
    expect(getTableSpecs().find((t) => t.id === 'round-60')?.capacity).toBe(8);
  });

  it('creates fixture types and reads them back', () => {
    setFixtureTypes([
      { id: 'dance-floor', name: 'Dance Floor', shape: 'rect', width: 18, height: 18, category: 'interior' },
      { id: 'stage', name: 'Stage', shape: 'rect', width: 20, height: 10, category: 'interior' },
    ] as any);
    expect(getFixtureTypes()).toHaveLength(2);
    expect(getFixtureTypes().find((f) => f.id === 'stage')?.name).toBe('Stage');
  });

  it('persists a template referencing a venue, tables, and fixtures', () => {
    setVenues([{ id: 'ballroom', name: 'Grand Ballroom', width: 80, height: 60, capacity: 250, category: 'reception', color: '#fff' }] as any);
    setTableSpecs([{ id: 'round-60', name: 'Round 60"', shape: 'circle', width: 5, height: 5, capacity: 8 }] as any);
    setTemplates([
      {
        id: 'tpl-1',
        name: 'Classic Reception',
        description: '20 round tables + dance floor',
        category: 'reception',
        venueId: 'ballroom',
        tables: [
          { id: 'T1', type: 'table', specId: 'round-60', x: 10, y: 10, rotation: 0, label: 'T1', guests: [] },
        ],
        fixtures: [{ id: 'F1', type: 'fixture', specId: 'dance-floor', x: 40, y: 30, rotation: 0, label: 'Dance Floor' }],
        createdAt: new Date().toISOString(),
      },
    ] as any);
    const tpl = getTemplates()[0];
    expect(tpl.id).toBe('tpl-1');
    expect(tpl.tables[0].specId).toBe('round-60');
    expect(tpl.fixtures[0].specId).toBe('dance-floor');
    expect(tpl.venueId).toBe('ballroom');
  });

  it('stores guidelines used for layout validation', () => {
    setGuidelines([{ id: 'g1', title: 'Keep 6ft aisle', description: 'Maintain 6ft aisles' }] as any);
    expect(getGuidelines()).toHaveLength(1);
  });

  it('template with empty tables is valid (seating-only space)', () => {
    setTemplates([
      { id: 'tpl-ceremony', name: 'Garden Ceremony', category: 'ceremony', venueId: 'garden', tables: [], fixtures: [{ id: 'F', type: 'fixture', specId: 'stage', x: 50, y: 20, rotation: 0, label: 'Stage' }], createdAt: new Date().toISOString() },
    ] as any);
    expect(getTemplates()[0].tables).toEqual([]);
    expect(getTemplates()[0].fixtures).toHaveLength(1);
  });
});
