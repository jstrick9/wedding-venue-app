import { RSVPSubmission } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const KEY = STORAGE_KEYS.COUPLE_SUBMISSIONS;
const VERSION = STORAGE_VERSIONS.COUPLE_SUBMISSIONS;

export function getCoupleRsvpSubmissions(coupleEventId: string): RSVPSubmission[] {
  const all = loadVersionedStorage<RSVPSubmission[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is RSVPSubmission[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  return all.filter((s) => s.eventKey === coupleEventId || s.eventName === coupleEventId);
}

export function setCoupleRsvpSubmissions(coupleEventId: string, submissions: RSVPSubmission[]): void {
  const all = loadVersionedStorage<RSVPSubmission[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is RSVPSubmission[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  const rest = all.filter((s) => !(s.eventKey === coupleEventId || s.eventName === coupleEventId));
  saveVersionedStorage(KEY, VERSION, [...rest, ...submissions]);
}

/** Remove a guest's RSVP submission for a couple event (e.g. when the guest is removed). */
/**
 * Upsert a single RSVP submission for a couple event (used by the couple to
 * record a guest's RSVP taken over the phone/email, or to correct one).
 */
export function upsertCoupleRsvp(
  coupleEventId: string,
  submission: RSVPSubmission,
): void {
  const all = loadVersionedStorage<RSVPSubmission[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is RSVPSubmission[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  const rest = all.filter((s) => !(s.eventKey === coupleEventId && s.guestId === submission.guestId));
  saveVersionedStorage(KEY, VERSION, [...rest, submission]);
}

export function removeCoupleRsvp(coupleEventId: string, guestId: string): void {
  const all = loadVersionedStorage<RSVPSubmission[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is RSVPSubmission[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  saveVersionedStorage(
    KEY,
    VERSION,
    all.filter((s) => !(s.eventKey === coupleEventId && s.guestId === guestId)),
  );
}

/** Remove all RSVP submissions belonging to a couple event (on delete). */
export function removeCoupleRsvps(coupleEventId: string): void {
  const all = loadVersionedStorage<RSVPSubmission[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is RSVPSubmission[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  saveVersionedStorage(
    KEY,
    VERSION,
    all.filter((s) => !(s.eventKey === coupleEventId || s.eventName === coupleEventId)),
  );
}
