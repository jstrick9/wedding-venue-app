import { CoupleSetupTask } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const KEY = STORAGE_KEYS.COUPLE_SETUP_TASKS;
const VERSION = STORAGE_VERSIONS.COUPLE_SETUP_TASKS;

function readAll(): CoupleSetupTask[] {
  return loadVersionedStorage<CoupleSetupTask[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is CoupleSetupTask[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
}

function writeAll(tasks: CoupleSetupTask[]): void {
  saveVersionedStorage(KEY, VERSION, tasks);
}

/** The venue's setup/staffing tasks for one couple event (sorted by scheduled time). */
export function getCoupleSetupTasks(coupleEventId: string): CoupleSetupTask[] {
  return readAll()
    .filter((t) => t.coupleEventId === coupleEventId)
    .sort((a, b) => (a.scheduledFor || '').localeCompare(b.scheduledFor || ''));
}

/** Backup read — all setup tasks across every couple. */
export function getCoupleSetupTasksForBackup(): CoupleSetupTask[] {
  return readAll();
}

export function addCoupleSetupTask(
  coupleEventId: string,
  input: {
    title: string;
    spaceId?: string;
    dayIndex?: number;
    assignee?: string;
    scheduledFor?: string;
    status?: CoupleSetupTask['status'];
    notes?: string;
  },
): CoupleSetupTask | null {
  const title = input.title.trim();
  if (!title) return null;
  const task: CoupleSetupTask = {
    id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    coupleEventId,
    title,
    spaceId: input.spaceId || undefined,
    dayIndex: input.dayIndex,
    assignee: input.assignee?.trim() || undefined,
    scheduledFor: input.scheduledFor || undefined,
    status: input.status || 'not-started',
    notes: input.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeAll([...readAll(), task]);
  return task;
}

export function updateCoupleSetupTask(
  coupleEventId: string,
  taskId: string,
  updates: Partial<Pick<CoupleSetupTask, 'title' | 'spaceId' | 'dayIndex' | 'assignee' | 'scheduledFor' | 'status' | 'notes'>>,
): void {
  writeAll(
    readAll().map((t) =>
      t.id === taskId && t.coupleEventId === coupleEventId
        ? { ...t, ...updates, updatedAt: new Date().toISOString() }
        : t,
    ),
  );
}

export function removeCoupleSetupTask(coupleEventId: string, taskId: string): void {
  writeAll(readAll().filter((t) => !(t.id === taskId && t.coupleEventId === coupleEventId)));
}

/** Remove all setup tasks for a couple event (on delete). */
export function removeCoupleSetupTasks(coupleEventId: string): void {
  writeAll(readAll().filter((t) => t.coupleEventId !== coupleEventId));
}
