import { useRef, useState } from 'react';
import type { User } from '../../types';
import { useBrandingConfig } from '../../config';
import { downloadBackupBundle } from '../../utils/backupExport';
import {
  applyBackupPayload,
  getRollbackBackup,
  parseBackupBundle,
  preflightBackupImport,
  snapshotCurrentProjectForRollback,
} from '../../utils/backupImport';
import type { BackupImportReport, BackupBundle } from '../../utils/backupTypes';
import { showToast } from '../Toast';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';

interface BackupManagementProps {
  user: User | null;
  onDataRestored: () => void;
}

/**
 * Backup & Restore — exposes the (previously UI-unreachable) backup utilities
 * so a venue owner can export a full backup bundle, import/restore one (with
 * preflight validation and an automatic rollback snapshot), and restore the
 * last rollback if an import went wrong.
 */
export function BackupManagement({ user, onDataRestored }: BackupManagementProps) {
  const config = useBrandingConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [report, setReport] = useState<BackupImportReport | null>(null);
  const [lastImported, setLastImported] = useState<BackupBundle | null>(null);
  const [rollbackAvailable, setRollbackAvailable] = useState<boolean>(
    () => getRollbackBackup() !== null,
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadBackupBundle(user ? { id: user.id, name: user.name } : undefined);
      showToast('Backup downloaded.', 'success');
    } catch (err) {
      showToast(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'warning');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setReport(null);
    try {
      const text = await file.text();
      const bundle = await parseBackupBundle(text);
      const preflight = await preflightBackupImport(bundle);
      setLastImported(bundle);
      setReport(preflight);
      if (preflight.valid) {
        // Keep a rollback snapshot of the current state before overwriting.
        await snapshotCurrentProjectForRollback(user ? { id: user.id, name: user.name } : undefined);
        setRollbackAvailable(true);
      }
    } catch (err) {
      setReport({
        valid: false,
        errors: [`Could not read backup file: ${err instanceof Error ? err.message : 'invalid JSON'}`],
        warnings: [],
      });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleConfirmRestore = async () => {
    if (!lastImported) return;
    try {
      applyBackupPayload(lastImported.payload, 'replace');
      showToast('Backup restored successfully.', 'success');
      setLastImported(null);
      setReport(null);
      onDataRestored();
    } catch (err) {
      showToast(`Restore failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'warning');
    }
  };

  const handleRollback = () => {
    const rollback = getRollbackBackup();
    if (!rollback) {
      showToast('No rollback snapshot available.', 'info');
      return;
    }
    applyBackupPayload(rollback.payload, 'replace');
    showToast('Restored to the pre-import snapshot.', 'success');
    setRollbackAvailable(false);
    onDataRestored();
  };

  return (
    <div className="space-y-6">
      <BrandedSectionHeader
        icon="💾"
        title="Backup &amp; Restore"
        description="Download a full backup of this workspace (venues, tables, guests, layouts, decor, messages, portal, staff, settings) as a single JSON file, or restore from one. A rollback snapshot is kept automatically before each restore."
        config={config}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-3">
          <h4 className="font-medium text-gray-700">Export backup</h4>
          <p className="text-xs text-gray-500">Save a copy you can keep or move to another device.</p>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: config.primaryColor }}
          >
            {isExporting ? 'Preparing…' : '📥 Download Backup'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-3">
          <h4 className="font-medium text-gray-700">Import / restore</h4>
          <p className="text-xs text-gray-500">Upload a backup JSON to preflight-check and restore it.</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: config.primaryColor }}
          >
            {isImporting ? 'Reading…' : '📤 Choose Backup File'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />
        </div>
      </div>

      {report && (
        <div className={`rounded-xl border p-4 ${report.valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className={`font-semibold ${report.valid ? 'text-green-800' : 'text-red-800'}`}>
              {report.valid ? '✓ Backup is valid' : '✗ Backup has problems'}
            </h4>
            <span className="text-xs text-gray-500">
              {report.summary
                ? `${report.summary.venueCount} venues · ${report.summary.userCount} users · ${report.summary.savedLayoutCount} layouts · ${report.summary.decorItemCount} decor`
                : ''}
            </span>
          </div>
          {report.errors.length > 0 && (
            <ul className="space-y-1 text-sm text-red-700">
              {report.errors.map((err, i) => <li key={i}>• {err}</li>)}
            </ul>
          )}
          {report.warnings.length > 0 && (
            <ul className="space-y-1 text-sm text-amber-700 mt-2">
              {report.warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          )}
          {report.valid && (
            <button
              type="button"
              onClick={() => void handleConfirmRestore()}
              className="mt-3 px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: config.primaryColor }}
            >
              Confirm Restore
            </button>
          )}
        </div>
      )}

      {rollbackAvailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-medium text-amber-800 mb-1">Restore last rollback</div>
          <p className="text-xs text-amber-700 mb-2">
            A snapshot of the project before the last import is available. Use this to undo a bad restore.
          </p>
          <button
            type="button"
            onClick={handleRollback}
            className="px-4 py-2 rounded-lg border border-amber-300 bg-white text-amber-800 text-sm font-medium hover:bg-amber-100"
          >
            ↩ Restore Rollback Snapshot
          </button>
        </div>
      )}
    </div>
  );
}
