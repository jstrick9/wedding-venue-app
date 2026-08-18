import { RSVPSubmission } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const KEY = STORAGE_KEYS.COUPLE_SUBMISSIONS;
const VERSION = STORAGE_VERSIONS.COUPLE_SUBMISSIONS;

function readAll(): RSVPSubmission[] {
  return loadVersionedStorage<RSVPSubmission[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is RSVPSubmission[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
}

function belongsToCouple(submission: RSVPSubmission, coupleEventId: string): boolean {
  return submission.eventKey === coupleEventId || submission.eventName === coupleEventId;
}

function scopeSubmission(coupleEventId: string, submission: RSVPSubmission): RSVPSubmission {
  return {
    ...submission,
    eventName: submission.eventName || coupleEventId,
    eventKey: coupleEventId,
  };
}

export function getCoupleRsvpSubmissions(coupleEventId: string): RSVPSubmission[] {
  return readAll().filter((s) => belongsToCouple(s, coupleEventId));
}

/** Backup read — all couple-scoped RSVP submissions across every event. */
export function getCoupleRsvpSubmissionsForBackup(): RSVPSubmission[] {
  return readAll();
}

export function setCoupleRsvpSubmissions(
  coupleEventId: string,
  submissions: RSVPSubmission[],
): void {
  const rest = readAll().filter((s) => !belongsToCouple(s, coupleEventId));
  saveVersionedStorage(
    KEY,
    VERSION,
    [...rest, ...submissions.map((s) => scopeSubmission(coupleEventId, s))],
  );
}

/**
 * Upsert a single RSVP submission for a couple event (used by the couple to
 * record a guest's RSVP taken over the phone/email, or to correct one).
 */
export function upsertCoupleRsvp(
  coupleEventId: string,
  submission: RSVPSubmission,
): void {
  const scoped = scopeSubmission(coupleEventId, submission);
  const rest = readAll().filter(
    (s) => !(belongsToCouple(s, coupleEventId) && s.guestId === scoped.guestId),
  );
  saveVersionedStorage(KEY, VERSION, [...rest, scoped]);
}

/** Remove a guest's RSVP submission for a couple event (e.g. when the guest is removed). */
export function removeCoupleRsvp(coupleEventId: string, guestId: string): void {
  saveVersionedStorage(
    KEY,
    VERSION,
    readAll().filter(
      (s) => !(belongsToCouple(s, coupleEventId) && s.guestId === guestId),
    ),
  );
}

/** Remove all RSVP submissions belonging to a couple event (on delete). */
export function removeCoupleRsvps(coupleEventId: string): void {
  saveVersionedStorage(
    KEY,
    VERSION,
    readAll().filter((s) => !belongsToCouple(s, coupleEventId)),
  );
}
