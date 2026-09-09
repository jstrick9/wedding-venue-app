import { BACKUP_DOMAINS } from './backupDomains';
import {
  rebindVenueMapRecoveryAfterRedaction,
  venueMapStructuralRecoveryBackupIssue,
} from '../services/wayfinding/venueWayfindingService';
import { redactValue, redactValueByOmittingSecrets } from './backupSecrets';
import type { BackupBundle, BackupBundleSummary, BackupPayload } from './backupTypes';

export const BACKUP_BUNDLE_VERSION = 2;

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildSummary(payload: BackupPayload): BackupBundleSummary {
  return {
    venueCount: Array.isArray(payload.venues) ? payload.venues.length : 0,
    templateCount: Array.isArray(payload.templates) ? payload.templates.length : 0,
    userCount: Array.isArray(payload.users) ? payload.users.length : 0,
    savedLayoutCount: Array.isArray(payload.savedLayouts) ? payload.savedLayouts.length : 0,
    decorItemCount: Array.isArray(payload.decorItems) ? payload.decorItems.length : 0,
    decorArrangementCount: Array.isArray(payload.decorArrangements)
      ? payload.decorArrangements.length
      : 0,
    guestPortalSubmissionCount: Array.isArray(payload.rsvpSubmissions)
      ? payload.rsvpSubmissions.length
      : 0,
  };
}

export async function buildBackupBundle(actor?: {
  id?: string;
  name?: string;
}): Promise<BackupBundle> {
  const payload: BackupPayload = {};

  for (const domain of BACKUP_DOMAINS) {
    try {
      payload[domain.key] = domain.read();
    } catch {
      // A domain that throws while reading should not fail the whole backup;
      // store its default so the rest of the bundle is still valid.
      payload[domain.key] = domain.defaultValue;
    }
  }

  const recoveryIssue = venueMapStructuralRecoveryBackupIssue(
    payload.venueMapStructuralRecovery,
    payload.venueMapConfigs,
  );
  if (recoveryIssue) {
    throw new Error(`Backup could not capture a consistent Venue Map recovery state: ${recoveryIssue}`);
  }

  const summary = buildSummary(payload);
  const payloadJson = JSON.stringify(payload);
  const payloadHash = await sha256(payloadJson);

  return {
    manifest: {
      app: 'seven-paths-manor-layout-planner',
      bundleVersion: BACKUP_BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy: actor,
      source: 'browser-local-storage',
    },
    summary,
    checksums: {
      payloadHash,
    },
    payload,
  };
}

/**
 * Build a bundle whose payload is redacted of security material and whose
 * checksum is recomputed over the redacted payload. This is the only form that
 * should ever be serialized to a file / shared with another device.
 */
export async function buildRedactedExportBundle(actor?: {
  id?: string;
  name?: string;
}): Promise<BackupBundle> {
  const full = await buildBackupBundle(actor);
  const redactedPayload = redactValue(full.payload) as BackupPayload;
  const fullRecovery = full.payload.venueMapStructuralRecovery;
  const redactedRecovery = redactedPayload.venueMapStructuralRecovery;
  if (
    fullRecovery && typeof fullRecovery === 'object' && !Array.isArray(fullRecovery)
    && redactedRecovery && typeof redactedRecovery === 'object' && !Array.isArray(redactedRecovery)
    && Object.prototype.hasOwnProperty.call(fullRecovery, 'quarantinedMap')
  ) {
    redactedPayload.venueMapStructuralRecovery = {
      ...redactedRecovery,
      quarantinedMap: redactValueByOmittingSecrets(
        (fullRecovery as Record<string, unknown>).quarantinedMap,
      ),
      quarantinedMapRedacted: true,
    };
  }
  redactedPayload.venueMapStructuralRecovery = rebindVenueMapRecoveryAfterRedaction(
    redactedPayload.venueMapStructuralRecovery,
  );
  const recoveryIssue = venueMapStructuralRecoveryBackupIssue(
    redactedPayload.venueMapStructuralRecovery,
    redactedPayload.venueMapConfigs,
  );
  if (recoveryIssue) {
    throw new Error(`Backup redaction could not preserve Venue Map recovery integrity: ${recoveryIssue}`);
  }
  const payloadHash = await sha256(JSON.stringify(redactedPayload));
  return {
    ...full,
    checksums: { payloadHash },
    payload: redactedPayload,
  };
}

export async function downloadBackupBundle(actor?: {
  id?: string;
  name?: string;
}): Promise<void> {
  const bundle = await buildRedactedExportBundle(actor);
  const content = JSON.stringify(bundle, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spm-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
