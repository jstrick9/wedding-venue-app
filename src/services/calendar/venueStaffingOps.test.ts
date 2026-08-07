import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { syncShiftsForCalendarEvent, getShiftsForCalendarEvent, getStaffShifts, removeShiftsForCalendarEvent } from './venueShiftService';
import type { VenueCalendarEvent } from '../../types';

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Venue-admin persona: Operations & Staffing — creating staff tasks/areas, and the
 * calendar → staff-shift link (assigning staff to a calendar event creates shifts).
 */
describe('venue operations & staffing (venue admin)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a staff task with checklist and persists it', () => {
    const task = {
      id: 'task-1', title: 'Set up ceremony chairs', phase: 'setup', status: 'not-started',
      priority: 'high', assignedStaff: ['u1'], assignedAreas: ['garden'], tags: ['ceremony'],
      checklist: [{ id: 'c1', label: 'Unpack chairs', completed: false }, { id: 'c2', label: 'Arrange rows', completed: false }],
      createdAt: new Date().toISOString(), createdBy: 'u1',
    };
    localStorage.setItem(STORAGE_KEYS.STAFF_TASKS, JSON.stringify([task]));
    const stored = readJson(STORAGE_KEYS.STAFF_TASKS) as any[];
    expect(stored).toHaveLength(1);
    expect(stored[0].phase).toBe('setup');
    expect(stored[0].checklist).toHaveLength(2);
  });

  it('tracks task progress from its checklist', () => {
    const task = {
      id: 'task-1', title: 'Set up ceremony chairs', phase: 'setup', status: 'not-started',
      priority: 'high', assignedStaff: [], assignedAreas: [], tags: [],
      checklist: [{ id: 'c1', label: 'A', completed: true }, { id: 'c2', label: 'B', completed: false }],
      createdAt: new Date().toISOString(), createdBy: 'u1',
    };
    localStorage.setItem(STORAGE_KEYS.STAFF_TASKS, JSON.stringify([task]));
    const stored = (readJson(STORAGE_KEYS.STAFF_TASKS) as any[])[0];
    const done = stored.checklist.filter((i: any) => i.completed).length;
    expect(done).toBe(1);
  });

  it('assigning staff to a calendar event creates one shift per staff member', () => {
    const ev: VenueCalendarEvent = {
      id: 'ev1', title: 'Open House', category: 'open-house', date: '2026-09-10',
      startTime: '10:00', endTime: '14:00', assignees: ['u1', 'u2'],
    };
    syncShiftsForCalendarEvent(ev);
    const shifts = getShiftsForCalendarEvent('ev1');
    expect(shifts).toHaveLength(2);
    expect(shifts[0].staffId).toBe('u1');
    expect(shifts[0].calendarEventId).toBe('ev1');
    expect(shifts[0].startTime).toBe('2026-09-10T10:00:00');
    expect(getStaffShifts()).toHaveLength(2);
  });

  it('unassigning staff reconciles shifts (removes dropped assignees)', () => {
    const ev: VenueCalendarEvent = { id: 'ev1', title: 'Open House', category: 'open-house', date: '2026-09-10', startTime: '10:00', assignees: ['u1', 'u2'] };
    syncShiftsForCalendarEvent(ev);
    expect(getShiftsForCalendarEvent('ev1')).toHaveLength(2);
    syncShiftsForCalendarEvent({ ...ev, assignees: ['u1'] });
    const shifts = getShiftsForCalendarEvent('ev1');
    expect(shifts).toHaveLength(1);
    expect(shifts[0].staffId).toBe('u1');
  });

  it('deleting a calendar event removes its linked shifts', () => {
    const ev: VenueCalendarEvent = { id: 'ev1', title: 'Setup', category: 'staffing', date: '2026-09-11', assignees: ['u1'] };
    syncShiftsForCalendarEvent(ev);
    expect(getShiftsForCalendarEvent('ev1')).toHaveLength(1);
    removeShiftsForCalendarEvent('ev1');
    expect(getShiftsForCalendarEvent('ev1')).toHaveLength(0);
  });
});
