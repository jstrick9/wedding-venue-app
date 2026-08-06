import { VenueCalendarEvent, VenueCalendarCategory } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const KEY = STORAGE_KEYS.VENUE_CALENDAR_EVENTS;
const VERSION = STORAGE_VERSIONS.VENUE_CALENDAR_EVENTS;

export const CALENDAR_CATEGORY_LABELS: Record<VenueCalendarCategory, string> = {
  couple: 'Couple Event',
  'open-house': 'Open House',
  staffing: 'Staffing / Work',
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
  notes?: string;
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
    notes: input.notes?.trim() || undefined,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };
  writeAll([...readAll(), ev]);
  return ev;
}

export function updateVenueCalendarEvent(
  id: string,
  updates: Partial<Pick<VenueCalendarEvent, 'title' | 'category' | 'date' | 'startTime' | 'endTime' | 'spaceId' | 'coupleEventId' | 'notes'>>,
): void {
  writeAll(readAll().map((e) => (e.id === id ? { ...e, ...updates } : e)));
}

export function removeVenueCalendarEvent(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id));
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
