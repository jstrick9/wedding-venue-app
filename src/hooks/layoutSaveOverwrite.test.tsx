import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useLayoutState, setTableSpecs, setVenues, getSavedLayouts } from './useLayoutState';

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
 * Design Studio venue-admin: unsaved-work (dirty) tracking + Save Layout overwrite.
 */
describe('layout save overwrite + dirty tracking', () => {
  beforeEach(() => {
    localStorage.clear();
    setVenues([
      { id: 'ballroom', name: 'Grand Ballroom', width: 80, height: 60, capacity: 250, category: 'reception', color: '#fff' },
    ]);
    setTableSpecs([
      { id: 'round-60', name: 'Round 60"', shape: 'circle', width: 5, height: 5, capacity: 8, showChairs: true },
    ]);
  });

  it('saveLayoutWithOverwrite updates an existing layout in place', () => {
    const { result } = renderHook(() => useLayoutState('ballroom'));
    act(() => { result.current.addTable('round-60', { x: 10, y: 10 }); });
    act(() => { result.current.saveLayout('Evening Plan'); });

    // Change the layout, then overwrite the same name.
    act(() => { result.current.addTable('round-60', { x: 30, y: 30 }); });
    act(() => { result.current.saveLayoutWithOverwrite('evening plan'); }); // case-insensitive match

    const named = getSavedLayouts().filter(
      (l) => l.name === 'evening plan' || l.name === 'Evening Plan',
    );
    // Only one layout with that name exists (overwritten, not duplicated).
    expect(named.length).toBe(1);
    expect(named[0].tables).toHaveLength(2);
  });

  it('tracks layoutDirty across edits and clears on save', () => {
    const { result } = renderHook(() => useLayoutState('ballroom'));
    expect(result.current.layoutDirty).toBe(false);

    act(() => { result.current.addTable('round-60', { x: 10, y: 10 }); });
    expect(result.current.layoutDirty).toBe(true);

    act(() => { result.current.saveLayoutWithOverwrite('Plan'); });
    expect(result.current.layoutDirty).toBe(false);
  });
});
