import { CoupleChecklistItem } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const KEY = STORAGE_KEYS.COUPLE_CHECKLISTS;
const VERSION = STORAGE_VERSIONS.COUPLE_CHECKLISTS;

function readAll(): CoupleChecklistItem[] {
  return loadVersionedStorage<CoupleChecklistItem[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is CoupleChecklistItem[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
}

function writeAll(items: CoupleChecklistItem[]): void {
  saveVersionedStorage(KEY, VERSION, items);
}

/** The couple's checklist items for one event (oldest first). */
export function getCoupleChecklist(coupleEventId: string): CoupleChecklistItem[] {
  return readAll()
    .filter((i) => i.coupleEventId === coupleEventId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

/** Backup read — all checklist items across every couple. */
export function getCoupleChecklistsForBackup(): CoupleChecklistItem[] {
  return readAll();
}

export function addCoupleChecklistItem(
  coupleEventId: string,
  input: { title: string; phase?: string; dueDate?: string; createdBy?: string },
): CoupleChecklistItem | null {
  const title = input.title.trim();
  if (!title) return null;
  const item: CoupleChecklistItem = {
    id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    coupleEventId,
    title,
    done: false,
    phase: input.phase?.trim() || undefined,
    dueDate: input.dueDate?.trim() || undefined,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeAll([...readAll(), item]);
  return item;
}

export function updateCoupleChecklistItem(
  coupleEventId: string,
  itemId: string,
  updates: Partial<Pick<CoupleChecklistItem, 'title' | 'done' | 'phase' | 'dueDate'>>,
): void {
  writeAll(
    readAll().map((i) =>
      i.id === itemId && i.coupleEventId === coupleEventId
        ? { ...i, ...updates, updatedAt: new Date().toISOString() }
        : i,
    ),
  );
}

export function toggleCoupleChecklistItem(coupleEventId: string, itemId: string): void {
  writeAll(
    readAll().map((i) =>
      i.id === itemId && i.coupleEventId === coupleEventId
        ? { ...i, done: !i.done, updatedAt: new Date().toISOString() }
        : i,
    ),
  );
}

export function removeCoupleChecklistItem(coupleEventId: string, itemId: string): void {
  writeAll(readAll().filter((i) => !(i.id === itemId && i.coupleEventId === coupleEventId)));
}

/** Remove all checklist items for a couple event (on delete). */
export function removeCoupleChecklists(coupleEventId: string): void {
  writeAll(readAll().filter((i) => i.coupleEventId !== coupleEventId));
}
