import { describe, it, expect, beforeEach } from 'vitest';
import { syncShiftsForCalendarEvent, getShiftsForCalendarEvent, getStaffShifts } from './venueShiftService';

describe('venueShiftService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates one shift per assigned staff member for a calendar event', () => {
    syncShiftsForCalendarEvent({
      id: 'ev1',
      title: 'Open House',
      category: 'open-house',
      date: '2026-09-10',
      startTime: '10:00',
      endTime: '14:00',
      assignees: ['u1', 'u2'],
    } as any);

    const shifts = getShiftsForCalendarEvent('ev1');
    expect(shifts).toHaveLength(2);
    expect(shifts[0].staffId).toBe('u1');
    expect(shifts[0].calendarEventId).toBe('ev1');
    expect(shifts[0].startTime).toBe('2026-09-10T10:00:00');
    expect(getStaffShifts()).toHaveLength(2);
  });

  it('does not duplicate shifts on re-sync', () => {
    const ev = { id: 'ev1', title: 'Open House', category: 'open-house', date: '2026-09-10', assignees: ['u1'] } as any;
    syncShiftsForCalendarEvent(ev);
    syncShiftsForCalendarEvent(ev);
    expect(getShiftsForCalendarEvent('ev1')).toHaveLength(1);
  });

  it('does nothing when there are no assignees', () => {
    syncShiftsForCalendarEvent({ id: 'ev1', title: 'X', category: 'other', date: '2026-09-10' } as any);
    expect(getStaffShifts()).toHaveLength(0);
  });

  it('removes shifts for assignees dropped from the event', () => {
    syncShiftsForCalendarEvent({ id: 'ev1', title: 'Open House', category: 'open-house', date: '2026-09-10', assignees: ['u1', 'u2'] } as any);
    expect(getShiftsForCalendarEvent('ev1')).toHaveLength(2);
    // u2 is removed from the event.
    syncShiftsForCalendarEvent({ id: 'ev1', title: 'Open House', category: 'open-house', date: '2026-09-10', assignees: ['u1'] } as any);
    const shifts = getShiftsForCalendarEvent('ev1');
    expect(shifts).toHaveLength(1);
    expect(shifts[0].staffId).toBe('u1');
  });

  it('updates an existing shift when the event time changes', () => {
    syncShiftsForCalendarEvent({ id: 'ev1', title: 'Open House', category: 'open-house', date: '2026-09-10', startTime: '10:00', endTime: '14:00', assignees: ['u1'] } as any);
    expect(getShiftsForCalendarEvent('ev1')[0].startTime).toBe('2026-09-10T10:00:00');
    // Event rescheduled to 16:00.
    syncShiftsForCalendarEvent({ id: 'ev1', title: 'Open House', category: 'open-house', date: '2026-09-10', startTime: '16:00', endTime: '20:00', assignees: ['u1'] } as any);
    const shifts = getShiftsForCalendarEvent('ev1');
    expect(shifts).toHaveLength(1);
    expect(shifts[0].startTime).toBe('2026-09-10T16:00:00');
    expect(shifts[0].endTime).toBe('2026-09-10T20:00:00');
  });
});
