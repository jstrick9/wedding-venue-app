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
