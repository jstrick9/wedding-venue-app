import { BACKUP_DOMAINS } from './backupDomains';
import type { BackupBundle, BackupBundleSummary, BackupPayload } from './backupTypes';

const BUNDLE_VERSION = 1;

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

  const summary = buildSummary(payload);
  const payloadJson = JSON.stringify(payload);
  const payloadHash = await sha256(payloadJson);

  return {
    manifest: {
      app: 'seven-paths-manor-layout-planner',
      bundleVersion: BUNDLE_VERSION,
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

export async function downloadBackupBundle(actor?: {
  id?: string;
  name?: string;
}): Promise<void> {
  const bundle = await buildBackupBundle(actor);
  const content = JSON.stringify(bundle, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spm-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
