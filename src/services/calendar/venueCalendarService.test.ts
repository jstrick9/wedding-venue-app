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
} from './venueCalendarService';

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

  it('removes calendar records for a couple on delete', () => {
    addVenueCalendarEvent({ title: 'W', category: 'couple', date: '2026-09-01', coupleEventId: 'c1' });
    addVenueCalendarEvent({ title: 'O', category: 'other', date: '2026-09-02' });
    removeVenueCalendarEventsForCouple('c1');
    expect(getVenueCalendarEvents()).toHaveLength(1);
    expect(getVenueCalendarEvents()[0].title).toBe('O');
  });
});
