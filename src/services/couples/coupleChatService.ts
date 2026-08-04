import { CoupleMessage } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const KEY = STORAGE_KEYS.COUPLE_MESSAGES;
const VERSION = STORAGE_VERSIONS.COUPLE_MESSAGES;

export function getCoupleMessages(coupleEventId: string): CoupleMessage[] {
  const all = loadVersionedStorage<CoupleMessage[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is CoupleMessage[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  return all
    .filter((m) => m.coupleEventId === coupleEventId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function sendCoupleMessage(input: {
  coupleEventId: string;
  senderId: string;
  senderName: string;
  senderSide: 'venue' | 'couple';
  message: string;
}): CoupleMessage | null {
  const text = input.message.trim();
  if (!text) return null;
  const msg: CoupleMessage = {
    id: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    coupleEventId: input.coupleEventId,
    senderId: input.senderId,
    senderName: input.senderName,
    senderSide: input.senderSide,
    message: text,
    createdAt: new Date().toISOString(),
  };
  const all = loadVersionedStorage<CoupleMessage[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is CoupleMessage[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  saveVersionedStorage(KEY, VERSION, [...all, msg]);
  return msg;
}

/** Backup read — all couple messages across every event. */
export function getCoupleMessagesForBackup(): CoupleMessage[] {
  return loadVersionedStorage<CoupleMessage[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is CoupleMessage[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
}

export function getUnreadCoupleMessageCounts(coupleEventIds: string[]): Record<string, number> {
  const all = loadVersionedStorage<CoupleMessage[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is CoupleMessage[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  const counts: Record<string, number> = {};
  for (const id of coupleEventIds) {
    counts[id] = all.filter((m) => m.coupleEventId === id && m.senderSide === 'couple').length;
  }
  return counts;
}
