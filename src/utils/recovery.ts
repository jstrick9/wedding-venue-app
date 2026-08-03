import { STORAGE_KEYS } from '../constants/storageKeys';
import { BACKUP_DOMAINS } from './backupDomains';
import { buildBackupBundle } from './backupExport';
import type { BackupBundle } from './backupTypes';

export type RecoveryDomainStatus = 'healthy' | 'warning' | 'corrupt' | 'missing';

export interface RecoveryDomainReport {
  key: string;
  label: string;
  status: RecoveryDomainStatus;
  message: string;
  sizeBytes: number;
  backupKey?: string;
}

export interface ProjectHealthReport {
  generatedAt: string;
  overallStatus: 'healthy' | 'warning' | 'corrupt';
  domains: RecoveryDomainReport[];
}

const QUARANTINE_PREFIX = 'spm_quarantine_';
const EMERGENCY_SNAPSHOT_KEY = STORAGE_KEYS.RECOVERY_SNAPSHOT;

/**
 * The domains tracked by the corruption-health/recovery system. Derived from
 * the single backup-domain registry so the two can never drift apart.
 */
export const RECOVERY_DOMAINS: Array<{
  key: string;
  label: string;
  defaultValue: unknown;
}> = BACKUP_DOMAINS.filter((d) => d.recovery).map((d) => ({
  key: d.storageKey,
  label: d.label,
  defaultValue: d.defaultValue,
}));

function estimateSize(value: string | null): number {
  return value ? new Blob([value]).size : 0;
}

function inspectRawJson(key: string, label: string): RecoveryDomainReport {
  const raw = localStorage.getItem(key);
  const sizeBytes = estimateSize(raw);

  if (raw == null) {
    return {
      key,
      label,
      status: 'missing',
      message: 'No stored value found.',
      sizeBytes,
    };
  }

  try {
    JSON.parse(raw);
    return {
      key,
      label,
      status: 'healthy',
      message: 'Stored JSON parsed successfully.',
      sizeBytes,
    };
  } catch (error) {
    return {
      key,
      label,
      status: 'corrupt',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to parse stored JSON.',
      sizeBytes,
    };
  }
}

export function buildProjectHealthReport(): ProjectHealthReport {
  const domains = RECOVERY_DOMAINS.map((domain) =>
    inspectRawJson(domain.key, domain.label),
  );

  const overallStatus = domains.some((d) => d.status === 'corrupt')
    ? 'corrupt'
    : domains.some((d) => d.status === 'warning')
      ? 'warning'
      : 'healthy';

  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    domains,
  };
}

export function quarantineStorageKey(key: string): string | null {
  const raw = localStorage.getItem(key);
  if (raw == null) return null;

  const quarantineKey = `${QUARANTINE_PREFIX}${key}_${Date.now()}`;
  localStorage.setItem(quarantineKey, raw);
  localStorage.removeItem(key);
  return quarantineKey;
}

export function resetStorageDomain(key: string, defaultValue: unknown): void {
  localStorage.setItem(key, JSON.stringify(defaultValue));
}

export async function createEmergencyRecoverySnapshot(actor?: {
  id?: string;
  name?: string;
}): Promise<BackupBundle> {
  const bundle = await buildBackupBundle(actor);
  const json = JSON.stringify(bundle);
  
  // Check if we have enough storage space
  try {
    localStorage.setItem(EMERGENCY_SNAPSHOT_KEY, json);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded. Attempting to free space...');
      // Try to free space by removing old backups
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('spm_backup_') || key.startsWith('spm_quarantine_')) {
          localStorage.removeItem(key);
        }
      });
      // Try again
      try {
        localStorage.setItem(EMERGENCY_SNAPSHOT_KEY, json);
      } catch {
        throw new Error('Unable to create backup: storage quota exceeded');
      }
    } else {
      throw error;
    }
  }
  
  return bundle;
}

export function getEmergencyRecoverySnapshot(): BackupBundle | null {
  try {
    const raw = localStorage.getItem(EMERGENCY_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as BackupBundle) : null;
  } catch {
    return null;
  }
}

export function recoverCorruptDomains(): RecoveryDomainReport[] {
  const report = buildProjectHealthReport();

  report.domains
    .filter((domain) => domain.status === 'corrupt')
    .forEach((domain) => {
      const config = RECOVERY_DOMAINS.find((d) => d.key === domain.key);
      const backupKey = quarantineStorageKey(domain.key);

      if (config) {
        resetStorageDomain(domain.key, config.defaultValue);
      }

      domain.backupKey = backupKey || undefined;
    });

  return report.domains.filter((domain) => domain.status === 'corrupt');
}