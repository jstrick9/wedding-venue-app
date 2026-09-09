import { STORAGE_KEYS } from '../constants/storageKeys';
import { BACKUP_DOMAINS } from './backupDomains';
import { containsRedaction, countRedactedFields } from './backupSecrets';
import type { BackupBundle, BackupImportReport, BackupPayload } from './backupTypes';
import { emitDataChanged } from './appEvents';
import { BACKUP_BUNDLE_VERSION, buildBackupBundle } from './backupExport';
import {
  getVenueMapConfig,
  venueMapStructuralRecoveryBackupIssue,
} from '../services/wayfinding/venueWayfindingService';
import {
  validateDecorArrangement,
  validateDecorItem,
  validateDecorPackage,
  validateDecorReferences,
  validateEventQuestion,
  validateFixtureType,
  validateTableSpec,
  validateTemplate,
  validateTemplateReferences,
  validateUser,
  validateVenue,
  validateVenueMasterLayoutReferences,
} from './validators';

/** Push cross-reference validator issues into the errors/warnings lists. */
function pushReferenceIssues(
  issues: { path: string; message: string; severity: 'error' | 'warning' }[],
  errors: string[],
  warnings: string[],
): void {
  for (const ref of issues) {
    const line = `${ref.path}: ${ref.message}`;
    if (ref.severity === 'error') errors.push(line);
    else warnings.push(line);
  }
}

const ROLLBACK_KEY = STORAGE_KEYS.BACKUP_ROLLBACK;

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function parseBackupBundle(text: string): Promise<BackupBundle> {
  return JSON.parse(text) as BackupBundle;
}

export async function preflightBackupImport(
  bundle: BackupBundle,
): Promise<BackupImportReport> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!bundle?.manifest || bundle.manifest.app !== 'seven-paths-manor-layout-planner') {
    errors.push(
      'Backup file is not a recognized Seven Paths Manor backup bundle.',
    );
  }

  const bundleVersion = bundle?.manifest?.bundleVersion;
  if (!Number.isInteger(bundleVersion) || Number(bundleVersion) < 1) {
    errors.push('Backup bundle version is missing or invalid.');
  } else if (Number(bundleVersion) > BACKUP_BUNDLE_VERSION) {
    errors.push('Backup was created by a newer app version and cannot be restored safely.');
  }

  if (!bundle?.payload) {
    errors.push('Backup payload is missing.');
  }

  if (bundle?.payload) {
    const computedHash = await sha256(JSON.stringify(bundle.payload));
    if (bundle?.checksums?.payloadHash !== computedHash) {
      errors.push(
        'Backup checksum does not match payload. The file may be corrupted or modified.',
      );
    }
  }

  const payload = bundle?.payload || {};

  if (Number(bundleVersion) >= 2 && payload.venueMapStructuralRecovery === undefined) {
    errors.push('Backup is missing required Venue Map structural recovery metadata.');
  } else if (Number(bundleVersion) === 1 && payload.venueMapStructuralRecovery === undefined) {
    warnings.push(
      'This legacy backup predates portable Venue Map recovery metadata. Its canonical map can still be restored, but any quarantine state omitted by the old export cannot be recovered.',
    );
  }
  if (payload.venueMapStructuralRecovery !== undefined) {
    if (payload.venueMapConfigs === undefined) {
      errors.push('Venue Map structural recovery metadata is present without its canonical map.');
    } else {
      const recoveryIssue = venueMapStructuralRecoveryBackupIssue(
        payload.venueMapStructuralRecovery,
        payload.venueMapConfigs,
      );
      if (recoveryIssue) errors.push(recoveryIssue);
    }
  }

  // Warn when the bundle contains redacted security material (it was exported
  // with `buildRedactedExportBundle`), so users know accounts/tokens won't
  // transfer and must be re-created.
  const redactedDomainLabels: string[] = [];
  for (const domain of BACKUP_DOMAINS) {
    const incoming = payload[domain.key];
    if (incoming === undefined) continue;
    const redactedCount = countRedactedFields(incoming);
    if (redactedCount > 0) {
      redactedDomainLabels.push(
        `${domain.label} (${redactedCount} field${redactedCount === 1 ? '' : 's'} redacted)`,
      );
    }
  }
  if (redactedDomainLabels.length > 0) {
    warnings.push(
      `This backup contains redacted security material in: ${redactedDomainLabels.join(
        ', ',
      )}. Accounts, portal passwords, and invite/guest tokens will NOT be restored and must be re-created.`,
    );
  }

  // Redacted exports intentionally contain "[REDACTED]" markers in place of real
  // security values, which would fail strict validators. Skip validation of any
  // domain whose value carries redaction markers; a preflight warning already
  // tells the user those fields are not transferable.
  const validateArray = <T>(
    label: string,
    value: unknown,
    validator: (item: T) => {
      valid: boolean;
      issues: { message: string; severity: 'error' | 'warning' }[];
    },
  ) => {
    if (!Array.isArray(value)) return;
    if (containsRedaction(value)) return;

    value.forEach((item, index) => {
      const result = validator(item as T);
      result.issues.forEach((issue) => {
        const line = `${label} ${index + 1}: ${issue.message}`;
        if (issue.severity === 'error') {
          errors.push(line);
        } else {
          warnings.push(line);
        }
      });
    });
  };

  // Skip cross-reference checks too when the referenced domain is redacted,
  // since redacted IDs/tokens can no longer be compared meaningfully.
  const ref = <T extends unknown[]>(value: T | undefined): T =>
    (containsRedaction(value) ? [] : value) as T;

  validateArray('Venue', payload.venues, validateVenue as any);
  validateArray('Table Spec', payload.tableSpecs, validateTableSpec as any);
  validateArray('Fixture Type', payload.fixtureTypes, validateFixtureType as any);
  validateArray('Template', payload.templates, validateTemplate as any);
  validateArray('User', payload.users, validateUser as any);
  validateArray('Event Question', payload.eventQuestions, validateEventQuestion as any);
  validateArray('Decor Item', payload.decorItems, validateDecorItem as any);
  validateArray(
    'Decor Arrangement',
    payload.decorArrangements,
    validateDecorArrangement as any,
  );
  validateArray('Decor Package', payload.decorPackages, validateDecorPackage as any);

  // Cross-reference integrity: ensure templates reference real venues/table
  // specs/fixtures, venue master layouts reference real specs, and decor
  // arrangements/packages reference real items/arrangements. Without this, a
  // backup could import data whose references are dangling (broken templates,
  // empty venues on load).
  pushReferenceIssues(
    validateTemplateReferences(
      ref(Array.isArray(payload.templates) ? (payload.templates as any[]) : []),
      ref(Array.isArray(payload.venues) ? (payload.venues as any[]) : []),
      ref(Array.isArray(payload.tableSpecs) ? (payload.tableSpecs as any[]) : []),
      ref(Array.isArray(payload.fixtureTypes) ? (payload.fixtureTypes as any[]) : []),
    ),
    errors,
    warnings,
  );
  pushReferenceIssues(
    validateVenueMasterLayoutReferences(
      ref(Array.isArray(payload.venues) ? (payload.venues as any[]) : []),
      ref(Array.isArray(payload.tableSpecs) ? (payload.tableSpecs as any[]) : []),
      ref(Array.isArray(payload.fixtureTypes) ? (payload.fixtureTypes as any[]) : []),
    ),
    errors,
    warnings,
  );
  pushReferenceIssues(
    validateDecorReferences(
      ref(Array.isArray(payload.decorArrangements) ? (payload.decorArrangements as any[]) : []),
      ref(Array.isArray(payload.decorItems) ? (payload.decorItems as any[]) : []),
      ref(Array.isArray(payload.decorPackages) ? (payload.decorPackages as any[]) : []),
    ),
    errors,
    warnings,
  );

  if (payload.eventRoles !== undefined && !Array.isArray(payload.eventRoles)) {
    warnings.push('Event Roles: expected an array, import may ignore malformed values.');
  }

  if (payload.savedLayouts !== undefined && !Array.isArray(payload.savedLayouts)) {
    warnings.push('Saved Layouts: expected an array, import may ignore malformed values.');
  }

  if (payload.portalGuests !== undefined && !Array.isArray(payload.portalGuests)) {
    warnings.push('Portal Guests: expected an array, import may ignore malformed values.');
  }

  if (payload.rsvpSubmissions !== undefined && !Array.isArray(payload.rsvpSubmissions)) {
    warnings.push('RSVP Submissions: expected an array, import may ignore malformed values.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: bundle?.summary,
  };
}

export async function snapshotCurrentProjectForRollback(actor?: {
  id?: string;
  name?: string;
}): Promise<void> {
  const bundle = await buildBackupBundle(actor);
  localStorage.setItem(ROLLBACK_KEY, JSON.stringify(bundle));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Merge incoming backup data into the current project state.
 *  - arrays  → concatenate and de-duplicate by stable id (fallback: JSON string)
 *  - objects → shallow merge (incoming wins)
 *  - scalars / other → incoming wins
 * This is intentionally conservative so a merge can never destroy existing data.
 */
function mergeValue(current: unknown, incoming: unknown): unknown {
  if (incoming === undefined) return current;

  if (Array.isArray(current) && Array.isArray(incoming)) {
    const map = new Map<string, unknown>();
    const keyFor = (item: unknown): string => {
      const id = (item as { id?: string } | null)?.id;
      if (id) return `id:${id}`;
      try {
        return `json:${JSON.stringify(item)}`;
      } catch {
        return `idx:${Math.random()}`;
      }
    };
    [...current, ...incoming].forEach((item) => {
      map.set(keyFor(item), item);
    });
    return Array.from(map.values());
  }

  if (isPlainObject(current) && isPlainObject(incoming)) {
    return { ...current, ...incoming };
  }

  return incoming;
}

export function applyBackupPayload(
  payload: BackupPayload,
  mode: 'replace' | 'merge' = 'replace',
): void {
  if (payload.venueMapStructuralRecovery !== undefined) {
    if (payload.venueMapConfigs === undefined) {
      throw new Error('Venue Map structural recovery metadata cannot be restored without its canonical map.');
    }
    const targetMap = mode === 'merge'
      ? mergeValue(getVenueMapConfig(), payload.venueMapConfigs)
      : payload.venueMapConfigs;
    const recoveryIssue = venueMapStructuralRecoveryBackupIssue(
      payload.venueMapStructuralRecovery,
      targetMap,
    );
    if (recoveryIssue) throw new Error(recoveryIssue);
  }

  for (const domain of BACKUP_DOMAINS) {
    const incoming = payload[domain.key];
    if (incoming === undefined) continue;

    // Never let a redacted export overwrite live security material. If the
    // incoming value (or any nested value) was redacted, skip the whole domain
    // so we never clobber real passwords/tokens with "[REDACTED]".
    if (containsRedaction(incoming)) continue;

    const value =
      mode === 'merge' ? mergeValue(domain.read(), incoming) : incoming;

    // Versioned domains (config, saved layouts, direct messages, portal
    // config/guests, RSVP) are written as envelopes via their registry entry,
    // so imports never trigger a legacy-migration self-heal on load.
    domain.write(value);
  }

  emitDataChanged('all');
}

export function getRollbackBackup(): BackupBundle | null {
  try {
    const raw = localStorage.getItem(ROLLBACK_KEY);
    return raw ? (JSON.parse(raw) as BackupBundle) : null;
  } catch {
    return null;
  }
}