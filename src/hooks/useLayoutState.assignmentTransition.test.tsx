import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLayoutState } from './useLayoutState';

describe('useLayoutState assignment transitions table ↔ room fixture', () => {
  it('moves guest from table assignment to room fixture assignment', () => {
    // Seed a room-style lodging fixture type for this test.
    localStorage.setItem(
      'spm_fixtureTypes',
      JSON.stringify([
        {
          id: 'room-fixture-spec',
          name: 'Guest Room',
          shape: 'rectangle',
          width: 12,
          height: 10,
          category: 'lodging',
          lodgingType: 'rooms',
          isRoom: true,
          capacity: 2,
          color: '#e0f2fe',
          icon: '🛏️',
        },
      ]),
    );

    const { result } = renderHook(() => useLayoutState());

    let guestId = '';

    act(() => {
      guestId = result.current.addGuest('Alice');
      result.current.addTable('round-6', { x: 10, y: 10 });
      result.current.addFixture('room-fixture-spec', { x: 20, y: 20 });
    });

    const tableId = result.current.layout.tables.find(t => t.specId === 'round-6')?.id;
    const roomFixtureId = result.current.layout.fixtures.find(f => f.specId === 'room-fixture-spec')?.id;

    expect(tableId).toBeTruthy();
    expect(roomFixtureId).toBeTruthy();

    act(() => {
      result.current.assignGuestToTable(guestId, tableId!);
    });

    expect(result.current.guests.find(g => g.id === guestId)?.tableId).toBe(tableId!);
    expect(result.current.guests.find(g => g.id === guestId)?.roomId).toBeUndefined();
    expect(result.current.layout.tables.find(t => t.id === tableId!)?.guests).toContain(guestId);

    act(() => {
      result.current.assignGuestToRoom(guestId, roomFixtureId!);
    });

    // Guest should be moved to room assignment and removed from table assignment.
    expect(result.current.guests.find(g => g.id === guestId)?.roomId).toBe(roomFixtureId!);
    expect(result.current.guests.find(g => g.id === guestId)?.tableId).toBeUndefined();
    expect(result.current.layout.tables.find(t => t.id === tableId!)?.guests).not.toContain(guestId);
    expect(result.current.layout.fixtures.find(f => f.id === roomFixtureId!)?.guests || []).toContain(guestId);
  });
});
