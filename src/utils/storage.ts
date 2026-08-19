import { emit, type DataChangedType } from './appEvents';
import { BACKUP_DOMAINS } from './backupDomains';
export interface VersionedStorageEnvelope<T> {
  version: number;
  savedAt: string;
  data: T;
}

export type StorageMigration<T> = (input: unknown) => T;

interface LoadVersionedOptions<T> {
  key: string;
  defaultValue: T;
  currentVersion: number;
  migrations?: Record<number, StorageMigration<T>>;
  validate?: (value: unknown) => value is T;
  normalize?: (value: T) => T;
  legacyKeys?: string[];
}

const BACKUP_PREFIX = 'spm_backup_';

/**
 * Map a storage key to its canonical domain key via the backup/entity registry.
 * Falls back to 'all' when the key is not a known persistence domain, so the
 * event bus never carries an arbitrary/untyped domain string.
 */
export function storageKeyToDomainKey(key: string): DataChangedType {
  const def = BACKUP_DOMAINS.find(
    (entry) => entry.storageKey === key || entry.key === key,
  );
  return (def ? def.key : 'all') as DataChangedType;
}

function isEnvelope(value: unknown): value is VersionedStorageEnvelope<unknown> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'version' in value &&
      'data' in value,
  );
}

function backupCorruptStorage(key: string, raw: string): void {
  try {
    localStorage.setItem(`${BACKUP_PREFIX}${key}_${Date.now()}`, raw);
  } catch {
    // ignore backup failures
  }
}

function getFirstExistingRawValue(
  key: string,
  legacyKeys: string[] = [],
): { raw: string; sourceKey: string } | null {
  const keys = [key, ...legacyKeys];

  for (const candidate of keys) {
    const raw = localStorage.getItem(candidate);
    if (raw != null) {
      return { raw, sourceKey: candidate };
    }
  }

  return null;
}

export function saveVersionedStorage<T>(
  key: string,
  version: number,
  data: T,
  options: { emitChange?: boolean } = {},
): void {
  const envelope: VersionedStorageEnvelope<T> = {
    version,
    savedAt: new Date().toISOString(),
    data,
  };

  try {
    localStorage.setItem(key, JSON.stringify(envelope));
    if (options.emitChange !== false) {
      // Defer notification until the current call stack completes. Some local
      // getters seed defaults while a component is rendering; dispatching a
      // React-facing event synchronously from that getter causes setState-during
      // render warnings. The backend/couple bridges only need eventual delivery.
      const notify = () => {
        // Resolve the storage key to its canonical domain key so the typed
        // event bus always carries a registry-aligned type. Previously the raw
        // storage key (e.g. "spm_chair_specs") was emitted, which never matched
        // the backend pushDomain lookup and silently skipped cloud sync.
        emit('spm_data_changed', { type: storageKeyToDomainKey(key) });
      };
      if (typeof queueMicrotask === 'function') queueMicrotask(notify);
      else setTimeout(notify, 0);
    }
  } catch (error) {
    console.error(`Failed to save versioned storage for key ${key}:`, error);
    
    // Notify UI of storage error (e.g., quota exceeded) via the typed event bus.
    try {
      emit('spm_storage_error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown storage error',
        action: 'save',
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Ignore dispatch errors
    }
    
    throw error; // Re-throw so callers know save failed
  }
}

export function loadVersionedStorage<T>({
  key,
  defaultValue,
  currentVersion,
  migrations = {},
  validate,
  normalize,
  legacyKeys = [],
}: LoadVersionedOptions<T>): T {
  const found = getFirstExistingRawValue(key, legacyKeys);
  if (!found) return defaultValue;

  try {
    const parsed = JSON.parse(found.raw) as unknown;
    let candidate: T;

    if (isEnvelope(parsed)) {
      const envelope = parsed as VersionedStorageEnvelope<unknown>;
      const migration = migrations[envelope.version];

      if (envelope.version === currentVersion) {
        candidate = envelope.data as T;
      } else if (migration) {
        candidate = migration(envelope.data);
        saveVersionedStorage(key, currentVersion, candidate, { emitChange: false });
      } else {
        candidate = envelope.data as T;
      }
    } else {
      const rawMigration = migrations[0];
      candidate = rawMigration ? rawMigration(parsed) : (parsed as T);
      saveVersionedStorage(key, currentVersion, candidate, { emitChange: false });
    }

    const normalized = normalize ? normalize(candidate) : candidate;

    if (validate && !validate(normalized)) {
      throw new Error(`Validation failed for storage key: ${key}`);
    }

    return normalized;
  } catch (error) {
  console.error(`Failed to load versioned storage for key ${key}:`, error);
  backupCorruptStorage(found.sourceKey, found.raw);
  
  // Notify UI of storage error via the typed event bus.
  try {
    emit('spm_storage_error', {
      key,
      error: error instanceof Error ? error.message : 'Unknown storage error',
      action: 'load',
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Ignore dispatch errors
  }
  
  return defaultValue;
  }
}

export function removeStorageKeys(keys: string[]): void {
  keys.forEach((key) => localStorage.removeItem(key));
}