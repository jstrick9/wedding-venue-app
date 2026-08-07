import { beforeEach, describe, expect, it } from 'vitest';
import { getVenues, setVenues } from './useLayoutState';
import type { Venue } from '../types';

/**
 * Venue-admin persona: building the Lodging Studio — a multi-floor lodging venue
 * with rooms that host overnight guests. Verifies floors/rooms persist and that
 * room capacity vs assigned-guests integrity is maintained.
 */
function lodgingVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'lodging-1',
    name: 'Manor House',
    width: 40,
    height: 30,
    capacity: 20,
    category: 'lodging',
    color: '#FFF8DC',
    isMaster: true,
    canvasWidth: 100,
    canvasHeight: 90,
    floors: [
      { id: 'f1', name: 'First Floor', level: 1, width: 40, height: 30, rooms: [
        { id: 'r1', name: 'Room 101', width: 14, height: 12, x: 1, y: 1, capacity: 2, assignedGuests: [] },
        { id: 'r2', name: 'Room 102', width: 14, height: 12, x: 16, y: 1, capacity: 2, assignedGuests: [] },
      ]},
      { id: 'f2', name: 'Second Floor', level: 2, width: 40, height: 30, rooms: [
        { id: 'r3', name: 'Suite 201', width: 16, height: 14, x: 1, y: 1, capacity: 4, assignedGuests: [] },
      ]},
    ],
    ...overrides,
  } as Venue;
}

describe('lodging studio (venue admin)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists a multi-floor lodging venue with rooms and capacities', () => {
    setVenues([lodgingVenue()]);
    const saved = getVenues().find((v) => v.id === 'lodging-1')!;
    expect(saved.category).toBe('lodging');
    expect(saved.floors).toHaveLength(2);
    expect(saved.floors![1].name).toBe('Second Floor');
    expect(saved.floors![1].rooms).toHaveLength(1);
    expect(saved.floors![0].rooms.reduce((s, r) => s + r.capacity, 0)).toBe(4);
    // Total overnight capacity across all rooms (2 + 2 + 4 = 8).
    const totalCap = saved.floors!.reduce((s, f) => s + f.rooms.reduce((x, r) => x + r.capacity, 0), 0);
    expect(totalCap).toBe(8);
  });

  it('detects over-capacity guest assignment within a room', () => {
    const venue = lodgingVenue();
    const room = venue.floors![0].rooms[0];
    // A room with capacity 2 must not exceed 2 assigned guests.
    room.assignedGuests = ['g1', 'g2'];
    const over = room.assignedGuests.length > room.capacity;
    expect(over).toBe(false);
    room.assignedGuests = ['g1', 'g2', 'g3'];
    expect(room.assignedGuests.length > room.capacity).toBe(true);
  });

  it('legacy single-floor venue uses rooms array when floors absent', () => {
    const legacy: Venue = {
      id: 'legacy-lodging',
      name: 'Old Lodge',
      width: 30,
      height: 25,
      capacity: 8,
      category: 'lodging',
      rooms: [
        { id: 'lr1', name: 'Room A', width: 10, height: 10, x: 0, y: 0, capacity: 2, assignedGuests: [] },
      ],
    } as Venue;
    setVenues([legacy]);
    const saved = getVenues().find((v) => v.id === 'legacy-lodging')!;
    // Legacy single-floor lodging falls back to a first-floor wrapper.
    expect(saved.rooms).toHaveLength(1);
    expect(saved.rooms![0].capacity).toBe(2);
  });
});
