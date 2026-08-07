import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useLayoutState, setTableSpecs, setFixtureTypes, setVenues, setDecorItems, setTemplates, getTemplates, getVenues } from './useLayoutState';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', username: 'admin', role: 'admin', name: 'Admin User', isActive: true, createdAt: new Date().toISOString() },
    isAdmin: true, isBasicUser: false, isGuest: false,
    login: vi.fn(), logout: vi.fn(), continueAsGuest: vi.fn(), createUser: vi.fn(),
    updateUser: vi.fn(), deleteUser: vi.fn(), getAllUsers: vi.fn(() => []),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/**
 * Venue-admin persona: using the Layout Studio canvas to build a floor plan —
 * place tables/fixtures/decor, move, duplicate, remove, save a master layout,
 * and load a template. Exercises the real layout-state mutations.
 */
describe('layout studio canvas (venue admin)', () => {
  beforeEach(() => {
    localStorage.clear();
    setVenues([
      { id: 'ballroom', name: 'Grand Ballroom', width: 80, height: 60, capacity: 250, category: 'reception', color: '#fff' },
    ]);
    setTableSpecs([
      { id: 'round-60', name: 'Round 60"', shape: 'circle', width: 5, height: 5, capacity: 8, showChairs: true },
    ]);
    setFixtureTypes([
      { id: 'dance-floor', name: 'Dance Floor', shape: 'rectangle', width: 18, height: 18, category: 'interior' },
    ]);
    setDecorItems([{ id: 'centerpiece', name: 'Centerpiece', icon: '💐', width: 1, height: 1, categoryId: 'c1', createdAt: new Date().toISOString() } as any]);
  });

  it('places a table and a fixture on the canvas', () => {
    const { result } = renderHook(() => useLayoutState('ballroom'));
    act(() => { result.current.addTable('round-60', { x: 10, y: 10 }); });
    act(() => { result.current.addFixture('dance-floor', { x: 40, y: 30 }); });
    expect(result.current.layout.tables).toHaveLength(1);
    expect(result.current.layout.fixtures).toHaveLength(1);
    expect(result.current.layout.tables[0].x).toBe(10);
    expect(result.current.layout.fixtures[0].label).toBe('Dance Floor');
  });

  it('moves and duplicates a placed table', () => {
    const { result } = renderHook(() => useLayoutState('ballroom'));
    act(() => { result.current.addTable('round-60', { x: 10, y: 10 }); });
    const tableId = result.current.layout.tables[0].id;
    act(() => { result.current.updateTable(tableId, { x: 25, y: 20 }); });
    expect(result.current.layout.tables[0].x).toBe(25);
    act(() => { result.current.duplicateItem(tableId); });
    expect(result.current.layout.tables).toHaveLength(2);
    // Duplicate offset by +3.
    expect(result.current.layout.tables[1].x).toBe(28);
  });

  it('removes a placed item', () => {
    const { result } = renderHook(() => useLayoutState('ballroom'));
    act(() => { result.current.addTable('round-60', { x: 10, y: 10 }); });
    act(() => { result.current.addFixture('dance-floor', { x: 40, y: 30 }); });
    const tableId = result.current.layout.tables[0].id;
    act(() => { result.current.removeItem(tableId); });
    expect(result.current.layout.tables).toHaveLength(0);
    expect(result.current.layout.fixtures).toHaveLength(1);
  });

  it('saves a master layout onto the current venue', () => {
    const { result } = renderHook(() => useLayoutState('ballroom'));
    act(() => { result.current.addTable('round-60', { x: 10, y: 10 }); });
    act(() => { result.current.saveMasterLayout(); });
    const venue = getVenues().find((v) => v.id === 'ballroom');
    expect(venue?.masterLayout).toBeTruthy();
    expect(venue?.masterLayout?.tables).toHaveLength(1);
    expect(venue?.isMaster).toBe(true);
  });

  it('loads a template onto the canvas', () => {
    setTemplates([
      {
        id: 'tpl-1', name: 'Classic Reception', category: 'reception', venueId: 'ballroom',
        tables: [{ id: 'T1', type: 'table', specId: 'round-60', x: 5, y: 5, rotation: 0, label: 'T1', guests: [] }],
        fixtures: [], createdAt: new Date().toISOString(),
      },
    ] as any);
    const { result } = renderHook(() => useLayoutState('ballroom'));
    act(() => { result.current.loadTemplate(getTemplates()[0]); });
    expect(result.current.layout.tables).toHaveLength(1);
    expect(result.current.layout.name).toBe('Classic Reception');
  });
});
