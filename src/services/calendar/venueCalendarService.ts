import { VenueCalendarEvent, VenueCalendarCategory } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';
import { removeShiftsForCalendarEvent } from './venueShiftService';

const KEY = STORAGE_KEYS.VENUE_CALENDAR_EVENTS;
const VERSION = STORAGE_VERSIONS.VENUE_CALENDAR_EVENTS;

export const CALENDAR_CATEGORY_LABELS: Record<VenueCalendarCategory, string> = {
  couple: 'Couple Event',
  'open-house': 'Open House',
  staffing: 'Staffing / Work',
  blocked: 'Blocked / Unavailable',
  other: 'Other Event',
};

function readAll(): VenueCalendarEvent[] {
  return loadVersionedStorage<VenueCalendarEvent[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is VenueCalendarEvent[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
}

function writeAll(events: VenueCalendarEvent[]): void {
  saveVersionedStorage(KEY, VERSION, events);
}

export function getVenueCalendarEvents(): VenueCalendarEvent[] {
  return readAll().sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Backup read — all calendar events. */
export function getVenueCalendarEventsForBackup(): VenueCalendarEvent[] {
  return readAll();
}

/** Events whose date falls within [start, end] (inclusive, YYYY-MM-DD). */
export function getVenueCalendarEventsInRange(start: string, end: string): VenueCalendarEvent[] {
  return readAll().filter((e) => e.date >= start && e.date <= end);
}

export function addVenueCalendarEvent(input: {
  title: string;
  category: VenueCalendarCategory;
  date: string;
  startTime?: string;
  endTime?: string;
  spaceId?: string;
  coupleEventId?: string;
  assignees?: string[];
  notes?: string;
  recurrence?: VenueCalendarEvent['recurrence'];
  createdBy?: string;
}): VenueCalendarEvent | null {
  const title = input.title.trim();
  if (!title || !input.date) return null;
  const ev: VenueCalendarEvent = {
    id: `vce-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    category: input.category,
    date: input.date,
    startTime: input.startTime || undefined,
    endTime: input.endTime || undefined,
    spaceId: input.spaceId || undefined,
    coupleEventId: input.coupleEventId || undefined,
    assignees: input.assignees || undefined,
    notes: input.notes?.trim() || undefined,
    recurrence: input.recurrence,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };
  writeAll([...readAll(), ev]);
  return ev;
}

export function updateVenueCalendarEvent(
  id: string,
  updates: Partial<Pick<VenueCalendarEvent, 'title' | 'category' | 'date' | 'startTime' | 'endTime' | 'spaceId' | 'coupleEventId' | 'assignees' | 'notes' | 'recurrence'>>,
): void {
  writeAll(readAll().map((e) => (e.id === id ? { ...e, ...updates } : e)));
}

export function removeVenueCalendarEvent(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id));
  // Cascade-delete staff shifts linked to this event so they don't become orphaned.
  removeShiftsForCalendarEvent(id);
}

/** Compute the dates a recurring event occurs on within [start, end]. */
export function recurringDatesForEvent(
  ev: VenueCalendarEvent,
  start: string,
  end: string,
): string[] {
  if (!ev.recurrence) return ev.date >= start && ev.date <= end ? [ev.date] : [];
  const base = new Date(ev.date + 'T00:00:00');
  const baseDow = base.getDay();
  const baseDom = base.getDate();
  const baseMonth = base.getMonth();
  const baseYear = base.getFullYear();
  const out: string[] = [];
  const cursor = new Date(baseYear, baseMonth, 1);
  const endDate = new Date(end + 'T00:00:00');
  const max = 400; // safety
  let guard = 0;
  // Iterate month by month (weekly/monthly/yearly all recur by month step).
  while (cursor <= endDate && guard < max) {
    guard += 1;
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    if (ev.recurrence === 'weekly') {
      // Every week from base onwards, on the same weekday.
      let w = new Date(base);
      while (w.getTime() <= endDate.getTime() && guard < max) {
        guard += 1;
        const d = `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
        if (d >= start && d <= end) out.push(d);
        w.setDate(w.getDate() + 7);
      }
      break;
    }
    // monthly / yearly: same day-of-month (clamped) in the target month.
    const dom = Math.min(baseDom, new Date(y, m + 1, 0).getDate());
    const d = `${y}-${String(m + 1).padStart(2, '0')}-${String(dom).padStart(2, '0')}`;
    if (d >= start && d <= end && (y > baseYear || (y === baseYear && m > baseMonth) || (y === baseYear && m === baseMonth))) {
      out.push(d);
    }
    cursor.setMonth(cursor.getMonth() + (ev.recurrence === 'yearly' ? 12 : 1));
    void baseDow;
  }
  return out;
}

/** Reschedule a calendar event to a new date (drag-and-drop). */
export function moveVenueCalendarEvent(id: string, date: string): boolean {
  const events = readAll();
  const ev = events.find((e) => e.id === id);
  if (!ev) return false;
  writeAll(events.map((e) => (e.id === id ? { ...e, date } : e)));
  return true;
}

/** Remove calendar records linked to a couple event (on couple delete). */
export function removeVenueCalendarEventsForCouple(coupleEventId: string): void {
  writeAll(readAll().filter((e) => !(e.category === 'couple' && e.coupleEventId === coupleEventId)));
}

/** Upsert calendar records for each couple event (keeps couple views in sync). */
export function syncCoupleEventsToCalendar(couples: { id: string; coupleName: string; eventDate?: string; eventEndDate?: string }[]): void {
  const events = readAll();
  const coupleIds = new Set(couples.map((c) => c.id));
  const next = events.filter((e) => e.category !== 'couple' || coupleIds.has(e.coupleEventId || ''));
  couples.forEach((c) => {
    if (!c.eventDate) return;
    const existing = next.find((e) => e.category === 'couple' && e.coupleEventId === c.id);
    if (existing) {
      existing.title = c.coupleName;
      existing.date = c.eventDate;
    } else {
      next.push({
        id: `vce-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: c.coupleName,
        category: 'couple',
        date: c.eventDate,
        coupleEventId: c.id,
        createdAt: new Date().toISOString(),
      });
    }
  });
  writeAll(next);
}
