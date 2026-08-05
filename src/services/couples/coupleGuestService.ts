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

export function importCoupleGuests(
  coupleEventId: string,
  rows: { name: string; email?: string; phone?: string }[],
): number {
  const all = readGuests();
  const existing = all.filter((g) => g.eventName !== coupleEventId);
  const added = rows
    .filter((r) => r.name && r.name.trim())
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
