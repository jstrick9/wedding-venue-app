import { CoupleMessage } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const KEY = STORAGE_KEYS.COUPLE_MESSAGES;
const VERSION = STORAGE_VERSIONS.COUPLE_MESSAGES;
const READ_KEY = STORAGE_KEYS.COUPLE_CHAT_READ;

type ChatSide = 'venue' | 'couple';

interface ChatReadMarker {
  venue?: string; // ISO timestamp of when the venue last read this event's thread
  couple?: string; // ISO timestamp of when the couple last read this event's thread
}

function readMarkers(): Record<string, ChatReadMarker> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ChatReadMarker>) : {};
  } catch {
    return {};
  }
}

function writeMarkers(markers: Record<string, ChatReadMarker>): void {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(markers));
  } catch {
    // ignore storage failures
  }
}

/**
 * Mark the given side as having read the thread for an event (clears its unread
 * badge). The venue marks the couple side "read" when they open the chat pane,
 * and vice-versa for the couple.
 */
export function markCoupleChatRead(coupleEventId: string, side: ChatSide): void {
  const markers = readMarkers();
  markers[coupleEventId] = { ...(markers[coupleEventId] || {}), [side]: new Date().toISOString() };
  writeMarkers(markers);
}

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

/**
 * Unread message counts per event, from the perspective of `side`. A message is
 * "unread" if it came from the other side and was sent after that side's last
 * read marker. If no read marker exists yet, all incoming messages count as
 * unread (so the badge is meaningful even before a thread has been opened).
 */
export function getUnreadCoupleMessageCounts(
  coupleEventIds: string[],
  side: ChatSide = 'venue',
): Record<string, number> {
  const all = loadVersionedStorage<CoupleMessage[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is CoupleMessage[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  const markers = readMarkers();
  const counts: Record<string, number> = {};
  for (const id of coupleEventIds) {
    const marker = markers[id]?.[side];
    const markerTime = marker ? new Date(marker).getTime() : 0;
    counts[id] = all.filter(
      (m) =>
        m.coupleEventId === id &&
        m.senderSide !== side &&
        new Date(m.createdAt).getTime() > markerTime,
    ).length;
  }
  return counts;
}
