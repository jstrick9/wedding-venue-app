import { EventAnswer } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const KEY = STORAGE_KEYS.COUPLE_ANSWERS;
const VERSION = STORAGE_VERSIONS.COUPLE_ANSWERS;

/**
 * Couple answers to the venue's Event Questions, scoped per couple event.
 * Reuses the existing EventAnswer model (questionId/answerValue) so the venue's
 * Event Questions admin drives the questionnaire a couple fills out.
 */
export function getCoupleAnswers(coupleEventId: string): EventAnswer[] {
  const all = loadVersionedStorage<EventAnswer[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is EventAnswer[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  return all.filter((a) => a.eventId === coupleEventId);
}

/** Backup read — all couple answers across every event. */
export function getCoupleAnswersForBackup(): EventAnswer[] {
  return loadVersionedStorage<EventAnswer[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is EventAnswer[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
}

export function saveCoupleAnswers(coupleEventId: string, answers: EventAnswer[]): void {
  const all = loadVersionedStorage<EventAnswer[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is EventAnswer[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  const rest = all.filter((a) => a.eventId !== coupleEventId);
  saveVersionedStorage(KEY, VERSION, [...rest, ...answers]);
}
