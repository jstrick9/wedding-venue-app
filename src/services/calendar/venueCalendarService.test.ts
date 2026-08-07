import { describe, it, expect, beforeEach } from 'vitest';
import {
  getVenueCalendarEvents,
  getVenueCalendarEventsInRange,
  getVenueCalendarEventsForBackup,
  addVenueCalendarEvent,
  updateVenueCalendarEvent,
  removeVenueCalendarEvent,
  syncCoupleEventsToCalendar,
  removeVenueCalendarEventsForCouple,
  moveVenueCalendarEvent,
  recurringDatesForEvent,
} from './venueCalendarService';
import { syncShiftsForCalendarEvent, getShiftsForCalendarEvent } from './venueShiftService';

describe('venueCalendarService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds and reads calendar events sorted by date', () => {
    addVenueCalendarEvent({ title: 'Open House', category: 'open-house', date: '2026-09-10', startTime: '10:00', endTime: '14:00' });
    addVenueCalendarEvent({ title: 'Wedding', category: 'couple', date: '2026-09-05', coupleEventId: 'c1' });
    const events = getVenueCalendarEvents();
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe('Wedding'); // sorted by date
    expect(events[1].title).toBe('Open House');
  });

  it('filters events within a date range', () => {
    addVenueCalendarEvent({ title: 'A', category: 'other', date: '2026-09-01' });
    addVenueCalendarEvent({ title: 'B', category: 'other', date: '2026-09-15' });
    addVenueCalendarEvent({ title: 'C', category: 'other', date: '2026-10-01' });
    const inRange = getVenueCalendarEventsInRange('2026-09-01', '2026-09-30');
    expect(inRange.map((e) => e.title)).toEqual(['A', 'B']);
  });

  it('updates and removes events', () => {
    const ev = addVenueCalendarEvent({ title: 'X', category: 'other', date: '2026-09-01' })!;
    updateVenueCalendarEvent(ev.id, { title: 'Y', notes: 'hi' });
    expect(getVenueCalendarEvents()[0].title).toBe('Y');
    removeVenueCalendarEvent(ev.id);
    expect(getVenueCalendarEvents()).toHaveLength(0);
  });

  it('cascade-deletes linked staff shifts when an event is removed', () => {
    const ev = addVenueCalendarEvent({ title: 'Open House', category: 'open-house', date: '2026-09-10', startTime: '10:00', assignees: ['u1', 'u2'] })!;
    syncShiftsForCalendarEvent(ev as any);
    expect(getShiftsForCalendarEvent(ev.id)).toHaveLength(2);
    removeVenueCalendarEvent(ev.id);
    expect(getShiftsForCalendarEvent(ev.id)).toHaveLength(0);
  });

  it('rejects empty titles and backs up all', () => {
    expect(addVenueCalendarEvent({ title: '  ', category: 'other', date: '2026-09-01' })).toBeNull();
    addVenueCalendarEvent({ title: 'A', category: 'other', date: '2026-09-01' });
    expect(getVenueCalendarEventsForBackup()).toHaveLength(1);
  });

  it('syncs couple events into the calendar and cleans up removed couples', () => {
    addVenueCalendarEvent({ title: 'Keep', category: 'other', date: '2026-09-01' });
    addVenueCalendarEvent({ title: 'Old Couple', category: 'couple', date: '2026-08-01', coupleEventId: 'gone' });
    syncCoupleEventsToCalendar([
      { id: 'c1', coupleName: 'Smith & Jones', eventDate: '2026-10-01' },
      { id: 'c2', coupleName: 'Doe Wedding', eventDate: '2026-10-15' },
    ]);
    const events = getVenueCalendarEvents();
    expect(events.some((e) => e.title === 'Old Couple')).toBe(false); // removed
    expect(events.find((e) => e.coupleEventId === 'c1')?.title).toBe('Smith & Jones');
    expect(events.find((e) => e.coupleEventId === 'c1')?.date).toBe('2026-10-01');
    expect(events.find((e) => e.coupleEventId === 'c2')).toBeTruthy();
  });

  it('moves an event to a new date (drag-and-drop reschedule)', () => {
    const ev = addVenueCalendarEvent({ title: 'Open House', category: 'open-house', date: '2026-09-10' })!;
    expect(moveVenueCalendarEvent(ev.id, '2026-09-20')).toBe(true);
    expect(getVenueCalendarEvents()[0].date).toBe('2026-09-20');
    expect(moveVenueCalendarEvent('missing', '2026-10-01')).toBe(false);
  });

  it('expands recurring events across a date range', () => {
    const base = { id: 'e1', title: 'Monthly Open House', category: 'open-house' as const, date: '2026-09-10', createdAt: new Date().toISOString() };
    // Monthly recurring in Sep/Oct.
    const monthly = recurringDatesForEvent({ ...base, recurrence: 'monthly' as const }, '2026-09-01', '2026-11-30');
    expect(monthly).toContain('2026-09-10');
    expect(monthly).toContain('2026-10-10');
    expect(monthly).toContain('2026-11-10');

    // Weekly recurring.
    const weekly = recurringDatesForEvent({ ...base, recurrence: 'weekly' as const }, '2026-09-10', '2026-09-24');
    expect(weekly).toEqual(['2026-09-10', '2026-09-17', '2026-09-24']);

    // Non-recurring returns only the base date if in range.
    const none = recurringDatesForEvent({ ...base, recurrence: undefined }, '2026-09-01', '2026-11-30');
    expect(none).toEqual(['2026-09-10']);
  });

  it('removes calendar records for a couple on delete', () => {
    addVenueCalendarEvent({ title: 'W', category: 'couple', date: '2026-09-01', coupleEventId: 'c1' });
    addVenueCalendarEvent({ title: 'O', category: 'other', date: '2026-09-02' });
    removeVenueCalendarEventsForCouple('c1');
    expect(getVenueCalendarEvents()).toHaveLength(1);
    expect(getVenueCalendarEvents()[0].title).toBe('O');
  });
});
