import {
  CoupleGuestEvent,
  CoupleGuestEventKind,
  CoupleEvent,
  GuestPortalGuestRecord,
  WeddingPackage,
  PackageAddOn,
} from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';
import { getCoupleGuests, updateCoupleGuest } from './coupleGuestService';

const KEY = STORAGE_KEYS.COUPLE_GUEST_EVENTS;
const VERSION = STORAGE_VERSIONS.COUPLE_GUEST_EVENTS;

export const GUEST_EVENT_KIND_LABELS: Record<CoupleGuestEventKind, string> = {
  'rehearsal-dinner': 'Rehearsal Dinner',
  ceremony: 'Ceremony',
  'cocktail-hour': 'Cocktail Hour',
  reception: 'Reception',
  lodging: 'Overnight Lodging',
  activity: 'Activity',
  custom: 'Guest Event',
};

function readAll(): CoupleGuestEvent[] {
  return loadVersionedStorage<CoupleGuestEvent[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is CoupleGuestEvent[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
}

function writeAll(events: CoupleGuestEvent[]): void {
  saveVersionedStorage(KEY, VERSION, events);
}

export function getCoupleGuestEvents(coupleEventId: string): CoupleGuestEvent[] {
  return readAll()
    .filter((e) => e.coupleEventId === coupleEventId)
    .sort((a, b) => (a.dayIndex ?? 0) - (b.dayIndex ?? 0) || (a.startTime || '').localeCompare(b.startTime || ''));
}

export function getCoupleGuestEventsForBackup(): CoupleGuestEvent[] {
  return readAll();
}

export function findCoupleGuestEvent(id: string): CoupleGuestEvent | undefined {
  return readAll().find((e) => e.id === id);
}

export function addCoupleGuestEvent(
  coupleEventId: string,
  input: {
    title: string;
    kind: CoupleGuestEventKind;
    dayIndex?: number;
    startTime?: string;
    location?: string;
    description?: string;
    capacity: number;
    derived?: boolean;
  },
): CoupleGuestEvent | null {
  const title = input.title.trim();
  if (!title) return null;
  const ev: CoupleGuestEvent = {
    id: `ge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    coupleEventId,
    title,
    kind: input.kind,
    dayIndex: input.dayIndex,
    startTime: input.startTime || undefined,
    location: input.location?.trim() || undefined,
    description: input.description?.trim() || undefined,
    capacity: input.capacity,
    derived: input.derived ?? false,
    createdAt: new Date().toISOString(),
  };
  writeAll([...readAll(), ev]);
  return ev;
}

export function updateCoupleGuestEvent(
  coupleEventId: string,
  eventId: string,
  updates: Partial<Pick<CoupleGuestEvent, 'title' | 'capacity' | 'dayIndex' | 'startTime' | 'location' | 'description'>>,
): void {
  writeAll(
    readAll().map((e) =>
      e.id === eventId && e.coupleEventId === coupleEventId ? { ...e, ...updates } : e,
    ),
  );
}

export function removeCoupleGuestEvent(coupleEventId: string, eventId: string): void {
  // Remove the event and unassign it from all guests.
  writeAll(readAll().filter((e) => !(e.id === eventId && e.coupleEventId === coupleEventId)));
  getCoupleGuests(coupleEventId).forEach((g) => {
    if (g.guestEventIds?.includes(eventId)) {
      updateCoupleGuest(coupleEventId, g.id, { guestEventIds: g.guestEventIds.filter((x) => x !== eventId) });
    }
  });
}

/** Remove all guest events for a couple event (on delete). */
export function removeCoupleGuestEvents(coupleEventId: string): void {
  writeAll(readAll().filter((e) => e.coupleEventId !== coupleEventId));
}

// ── Per-guest assignment ────────────────────────────────────────────────────
export function assignGuestToEvent(coupleEventId: string, guestId: string, eventId: string): boolean {
  const guest = getCoupleGuests(coupleEventId).find((g) => g.id === guestId);
  if (!guest) return false;
  const ids = guest.guestEventIds || [];
  if (ids.includes(eventId)) return true;
  updateCoupleGuest(coupleEventId, guestId, { guestEventIds: [...ids, eventId] });
  return true;
}

export function removeGuestFromEvent(coupleEventId: string, guestId: string, eventId: string): void {
  const guest = getCoupleGuests(coupleEventId).find((g) => g.id === guestId);
  if (!guest || !guest.guestEventIds?.includes(eventId)) return;
  updateCoupleGuest(coupleEventId, guestId, { guestEventIds: guest.guestEventIds.filter((x) => x !== eventId) });
}

export function setGuestEvents(coupleEventId: string, guestId: string, eventIds: string[]): void {
  updateCoupleGuest(coupleEventId, guestId, { guestEventIds: eventIds });
}

export function getGuestEventIdsForGuest(coupleEventId: string, guestId: string): string[] {
  const guest = getCoupleGuests(coupleEventId).find((g) => g.id === guestId);
  return guest?.guestEventIds || [];
}

export function getAssignedGuestCount(coupleEventId: string, eventId: string): number {
  return getCoupleGuests(coupleEventId).filter((g) => g.guestEventIds?.includes(eventId)).length;
}

// ── Auto-derive from package + add-ons ──────────────────────────────────────
/**
 * Build the default guest-event list for a couple from their package and chosen
 * add-ons. Core events (ceremony, cocktail hour, reception) always appear;
 * rehearsal dinner, lodging, and activities are added when the package/add-ons
 * provide them.
 */
export function deriveGuestEvents(
  pkg: WeddingPackage | undefined,
  addOns: PackageAddOn[],
): { title: string; kind: CoupleGuestEventKind; capacity: number }[] {
  const events: { title: string; kind: CoupleGuestEventKind; capacity: number }[] = [];
  const addRehearsal = pkg?.durationType !== 'single-day' || pkg?.includedItems.includes('rehearsal-setup');
  if (addRehearsal) events.push({ title: 'Rehearsal Dinner', kind: 'rehearsal-dinner', capacity: 50 });
  events.push({ title: 'Ceremony', kind: 'ceremony', capacity: pkg?.maxGuests || 200 });
  events.push({ title: 'Cocktail Hour', kind: 'cocktail-hour', capacity: pkg?.maxGuests || 200 });
  events.push({ title: 'Reception', kind: 'reception', capacity: pkg?.maxGuests || 200 });
  if (pkg?.maxOvernightGuests || pkg?.lodgingIncluded || addOns.some((a) => a.category === 'lodging')) {
    events.push({ title: 'Overnight Lodging', kind: 'lodging', capacity: pkg?.maxOvernightGuests || 25 });
  }
  addOns.filter((a) => a.category === 'activity').forEach((a) => {
    events.push({ title: a.name, kind: 'activity', capacity: pkg?.maxGuests || 200 });
  });
  return events;
}

/** Ensure default guest events exist for a couple (idempotent; seeds if none). */
export function ensureDerivedGuestEvents(coupleEventId: string, pkg: WeddingPackage | undefined, addOns: PackageAddOn[]): void {
  const existing = getCoupleGuestEvents(coupleEventId);
  if (existing.length > 0) return;
  deriveGuestEvents(pkg, addOns).forEach((d) => {
    addCoupleGuestEvent(coupleEventId, { title: d.title, kind: d.kind, capacity: d.capacity, derived: true });
  });
}

/** Convenience: ensure defaults using a couple event + resolved add-ons. */
export function ensureDerivedGuestEventsForEvent(
  event: CoupleEvent,
  pkg: WeddingPackage | undefined,
  addOns: PackageAddOn[],
): void {
  ensureDerivedGuestEvents(event.id, pkg, addOns);
}
