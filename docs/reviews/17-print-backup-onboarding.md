# Module Review — 17: Print/Export, Backup UI & Onboarding

**Scope:** `src/components/PrintView.tsx`, `src/components/WelcomeModal.tsx`, and the backup/export utilities (`src/utils/backup*`).

## Findings

### INCOMPLETE (High) — The entire Backup & Restore feature was unreachable in the UI
The backup/export/import/restore utilities (`buildBackupBundle`, `downloadBackupBundle`, `parseBackupBundle`, `preflightBackupImport`, `applyBackupPayload`, `snapshotCurrentProjectForRollback`, `getRollbackBackup`) were never called from any component. So although Module 1 made them correct, **no user could actually back up or restore their data** — a critical data-safety feature with no UI.
**Fix:** Added a **Backup & Restore** panel (`src/components/admin/BackupManagement.tsx`) wired into the Admin Panel as a new "System & Backup" section. It provides:
- **Download Backup** (full bundle).
- **Import/Restore** — file picker → parse → `preflightBackupImport` validation (surfaces errors/warnings + summary) → auto rollback snapshot → **Confirm Restore** (`applyBackupPayload`, then `emitDataChanged('all')` to refresh the workspace).
- **Restore last rollback** — undo a bad import from the auto snapshot.

## Verified-good (no change)
- `PrintView` prints venue, tables, and guest list; capacity/coverage summary.
- `WelcomeModal` uses config-driven features and remembers dismissal.

## Cross-module impact
- `AdminPanel` gains a Backup tab (import `emitDataChanged`). Uses the Module 1-fixed utilities end-to-end.

## Validation
- Typecheck clean; full suite **263 passed / 11 skipped**; build succeeds.
