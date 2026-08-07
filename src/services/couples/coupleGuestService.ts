import {
  GuestPortalGuestRecord,
  GuestPortalConfig,
  EventAnswer,
} from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const GUESTS_KEY = STORAGE_KEYS.COUPLE_GUESTS;
const GUESTS_VERSION = STORAGE_VERSIONS.COUPLE_GUESTS;
const CONFIG_KEY = STORAGE_KEYS.COUPLE_PORTAL_CONFIGS;
const CONFIG_VERSION = STORAGE_VERSIONS.COUPLE_PORTAL_CONFIGS;

function readGuests(): GuestPortalGuestRecord[] {
  return loadVersionedStorage<GuestPortalGuestRecord[]>({
    key: GUESTS_KEY,
    defaultValue: [],
    currentVersion: GUESTS_VERSION,
    validate: (v): v is GuestPortalGuestRecord[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
}

function writeGuests(guests: GuestPortalGuestRecord[]): void {
  saveVersionedStorage(GUESTS_KEY, GUESTS_VERSION, guests);
}

/** Guests scoped to one couple event. */
export function getCoupleGuests(coupleEventId: string): GuestPortalGuestRecord[] {
  return readGuests().filter((g) => g.eventName === coupleEventId);
}

/** Remove all guests + portal config belonging to a couple event (on delete). */
export function removeCoupleGuestsAndConfig(coupleEventId: string): void {
  writeGuests(readGuests().filter((g) => g.eventName !== coupleEventId));
  const configs = readConfigs();
  if (coupleEventId in configs) {
    const next = { ...configs };
    delete next[coupleEventId];
    writeConfigs(next);
  }
}

/** Backup read — all couple guests across every event. */
export function getCoupleGuestsForBackup(): GuestPortalGuestRecord[] {
  return readGuests();
}

/** A guest invitation link that auto-identifies the guest in their couple's portal. */
export function buildGuestInviteUrl(guestToken: string, coupleEventId?: string): string {
  const couple = coupleEventId ? `&couple=${encodeURIComponent(coupleEventId)}` : '';
  return `${window.location.origin}${window.location.pathname}#/guest-portal?token=${encodeURIComponent(guestToken)}${couple}`;
}

/** Extract a couple event id from the guest-portal URL (?couple= in the hash). */
export function getCoupleIdFromLocation(location: Location = window.location): string | undefined {
  const hash = location.hash || '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex >= 0) {
    const params = new URLSearchParams(hash.slice(queryIndex + 1));
    return params.get('couple') || undefined;
  }
  return undefined;
}

export function addCoupleGuest(
  coupleEventId: string,
  input: { name: string; email?: string; phone?: string; plusOne?: boolean },
): GuestPortalGuestRecord {
  const guest: GuestPortalGuestRecord = {
    id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    email: input.email?.trim() || '',
    phone: input.phone?.trim() || '',
    eventName: coupleEventId,
    eventKey: coupleEventId,
    token: `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    allowPortalAccess: true,
  };
  const all = readGuests();
  const existing = all.filter((g) => g.id !== guest.id);
  writeGuests([...existing, guest]);
  return guest;
}

export function updateCoupleGuest(
  coupleEventId: string,
  guestId: string,
  updates: Partial<GuestPortalGuestRecord>,
): void {
  const all = readGuests().map((g) =>
    g.id === guestId && g.eventName === coupleEventId ? { ...g, ...updates } : g,
  );
  writeGuests(all);
}

export function removeCoupleGuest(coupleEventId: string, guestId: string): void {
  writeGuests(readGuests().filter((g) => !(g.id === guestId && g.eventName === coupleEventId)));
}

/** Download the couple's guest list as a CSV (name,email,phone). */
export function exportCoupleGuestsCsv(
  coupleEventId: string,
  rsvps?: { guestId: string; attending: boolean; mealChoice?: string; plusOneName?: string; dietaryNotes?: string }[],
): void {
  const guests = getCoupleGuests(coupleEventId);
  const byId = new Map((rsvps || []).map((r) => [r.guestId, r]));
  const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Name', 'Email', 'Phone', 'RSVP', 'Meal', 'Plus One', 'Dietary Notes', 'Table / Seat', 'Room'];
  const rows = guests.map((g) => {
    const r = byId.get(g.id);
    return [
      g.name,
      g.email || '',
      g.phone || '',
      r ? (r.attending ? 'Attending' : 'Not attending') : 'No response',
      r?.mealChoice || '',
      r?.plusOneName || '',
      r?.dietaryNotes || '',
      g.tableId || '',
      g.roomId || '',
    ].map(esc).join(',');
  });
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'guest-list.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function importCoupleGuests(
  coupleEventId: string,
  rows: { name: string; email?: string; phone?: string }[],
): number {
  const all = readGuests();
  // Keep every existing guest (including pre-existing ones for this couple) so an
  // import merges rather than replaces the couple's guest list.
  const existing = all;

  // Skip rows that duplicate an existing guest for this couple (by email, or by
  // name when no email) so an accidental re-import doesn't create duplicates.
  const existingForCouple = all.filter((g) => g.eventName === coupleEventId);
  const seenEmails = new Set(existingForCouple.map((g) => g.email?.trim().toLowerCase()).filter(Boolean));
  const seenNames = new Set(existingForCouple.map((g) => g.name.trim().toLowerCase()));

  const added = rows
    .filter((r) => r.name && r.name.trim())
    .filter((r) => {
      const email = (r.email?.trim() || '').toLowerCase();
      if (email) {
        if (seenEmails.has(email)) return false;
        seenEmails.add(email);
        return true;
      }
      const name = r.name.trim().toLowerCase();
      if (seenNames.has(name)) return false;
      seenNames.add(name);
      return true;
    })
    .map((r) => ({
      id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: r.name.trim(),
      email: r.email?.trim() || '',
      phone: r.phone?.trim() || '',
      eventName: coupleEventId,
      eventKey: coupleEventId,
      token: `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      allowPortalAccess: true,
    }));
  writeGuests([...existing, ...added]);
  return added.length;
}

// ── Per-couple guest portal config ──────────────────────────────────────────
function readConfigs(): Record<string, GuestPortalConfig> {
  return loadVersionedStorage<Record<string, GuestPortalConfig>>({
    key: CONFIG_KEY,
    defaultValue: {},
    currentVersion: CONFIG_VERSION,
    validate: (v): v is Record<string, GuestPortalConfig> => !!v && typeof v === 'object',
    normalize: (v) => (v && typeof v === 'object' ? (v as Record<string, GuestPortalConfig>) : {}),
  });
}

function writeConfigs(configs: Record<string, GuestPortalConfig>): void {
  saveVersionedStorage(CONFIG_KEY, CONFIG_VERSION, configs);
}

/** Default per-couple portal config, pre-seeded from the venue's shared config when available. */
export function getCouplePortalConfig(
  coupleEventId: string,
  venueConfig: GuestPortalConfig | null,
  couple: { coupleName: string; eventDate?: string; eventEndDate?: string },
): GuestPortalConfig {
  const configs = readConfigs();
  if (configs[coupleEventId]) return configs[coupleEventId];

  const base: GuestPortalConfig = {
    eventTitle: couple.coupleName,
    eventStartDate: couple.eventDate || '',
    eventEndDate: couple.eventEndDate || '',
    isMultiDay: !!(couple.eventDate && couple.eventEndDate && couple.eventEndDate !== couple.eventDate),
    heroImageUrl: venueConfig?.heroImageUrl || '',
    welcomeMessage: venueConfig?.welcomeMessage || `Welcome to ${couple.coupleName}'s wedding!`,
    rsvpMessage: venueConfig?.rsvpMessage || 'Please let us know if you can make it.',
    rsvpDeadlineDate: venueConfig?.rsvpDeadlineDate || '',
    portalPasswordHash: venueConfig?.portalPasswordHash,
    portalPasswordSalt: venueConfig?.portalPasswordSalt,
    portalPassword: venueConfig?.portalPassword,
    showMap: venueConfig?.showMap ?? true,
    showSchedule: venueConfig?.showSchedule ?? true,
    showWayfinding: venueConfig?.showWayfinding ?? false,
    showRSVP: venueConfig?.showRSVP ?? true,
    showLodging: venueConfig?.showLodging ?? false,
    mealOptions: venueConfig?.mealOptions,
    scheduleItems: venueConfig?.scheduleItems || [],
    wayfindingPoints: venueConfig?.wayfindingPoints || [],
    accessGracePeriodHours: venueConfig?.accessGracePeriodHours ?? 36,
  };
  writeConfigs({ ...configs, [coupleEventId]: base });
  return base;
}

export function setCouplePortalConfig(coupleEventId: string, config: GuestPortalConfig): void {
  writeConfigs({ ...readConfigs(), [coupleEventId]: config });
}

/**
 * Push the venue's shared guest-portal settings onto every couple's portal
 * config, while preserving each couple's unique customizations.
 *
 * Venue-owned fields updated on each couple:
 *   - welcomeMessage / rsvpMessage (venue's message)
 *   - accessGracePeriodHours + tab visibility flags
 *   - mealOptions (venue's choices as the base, plus any couple-added options)
 *   - scheduleItems (venue's items as the base, plus any couple-added items)
 *
 * Couple-owned fields preserved (never overwritten):
 *   - heroImageUrl, rsvpDeadlineDate, eventTitle, event dates, isMultiDay,
 *     portal password.
 *
 * Returns the number of couple configs updated.
 */
export function pushSharedConfigToCouples(venueConfig: GuestPortalConfig | null): number {
  const configs = readConfigs();
  const ids = Object.keys(configs);
  if (ids.length === 0 || !venueConfig) return 0;

  let updated = 0;
  const next: Record<string, GuestPortalConfig> = { ...configs };
  for (const id of ids) {
    const cur = configs[id];
    if (!cur) continue;

    // Merge meal options: venue's base + any couple option not already present.
    const venueMeals = venueConfig.mealOptions || [];
    const coupleMeals = cur.mealOptions || [];
    const seen = new Set(venueMeals.map((o) => o.value));
    const mergedMeals = [
      ...venueMeals,
      ...coupleMeals.filter((o) => !seen.has(o.value)),
    ];

    // Merge schedule items: venue's base + any couple item not already present (by id).
    const venueItems = venueConfig.scheduleItems || [];
    const coupleItems = cur.scheduleItems || [];
    const seenIds = new Set(venueItems.map((i) => i.id));
    const mergedItems = [
      ...venueItems,
      ...coupleItems.filter((i) => !seenIds.has(i.id)),
    ];

    next[id] = {
      ...cur,
      welcomeMessage: venueConfig.welcomeMessage ?? cur.welcomeMessage,
      rsvpMessage: venueConfig.rsvpMessage ?? cur.rsvpMessage,
      accessGracePeriodHours: venueConfig.accessGracePeriodHours ?? cur.accessGracePeriodHours,
      showMap: venueConfig.showMap ?? cur.showMap,
      showSchedule: venueConfig.showSchedule ?? cur.showSchedule,
      showRSVP: venueConfig.showRSVP ?? cur.showRSVP,
      showWayfinding: venueConfig.showWayfinding ?? cur.showWayfinding,
      showLodging: venueConfig.showLodging ?? cur.showLodging,
      mealOptions: mergedMeals,
      scheduleItems: mergedItems,
    };
    updated += 1;
  }
  writeConfigs(next);
  return updated;
}

/** Backup read — all per-couple portal configs. */
export function getCouplePortalConfigsForBackup(): Record<string, GuestPortalConfig> {
  return readConfigs();
}

// ── Couple answers for the guest portal ─────────────────────────────────────
export function getCoupleAnswersForGuest(coupleEventId: string): EventAnswer[] {
  const all = loadVersionedStorage<EventAnswer[]>({
    key: STORAGE_KEYS.COUPLE_ANSWERS,
    defaultValue: [],
    currentVersion: STORAGE_VERSIONS.COUPLE_ANSWERS,
    validate: (v): v is EventAnswer[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  return all.filter((a) => a.eventId === coupleEventId);
}
