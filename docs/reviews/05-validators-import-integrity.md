# Module Review 05 — Validators & Backup/Import Integrity

**Scope:** `src/utils/validators.ts`, `src/utils/backupImport.ts`, `src/utils/backupExport.ts`, `src/utils/backupTypes.ts`, `src/utils/recovery.ts`.

## Summary

The validator suite is comprehensive and well-tested (per-entity validators for venues, tables, fixtures, templates, users, event questions, decor items/arrangements/packages, plus sanitization helpers). Backup/restore has checksum verification and rollback snapshots. One important gap was found: the **cross-reference validators were never connected to the import path**.

## Findings

### P2 — Cross-reference validators existed but weren't wired into backup import
`validators.ts` defines three strong integrity checks — `validateTemplateReferences`, `validateVenueMasterLayoutReferences`, and `validateDecorReferences` — that catch dangling references (a template pointing at a venue/table/fixture that doesn't exist; a venue master layout referencing missing specs; decor arrangements/packages referencing missing items). They were only referenced from their own unit tests.

As a result, `preflightBackupImport` validated each entity in isolation but **never checked whether entities referenced each other**, so a backup with broken references imported cleanly and produced templates/venues that silently failed on load (the exact class of bug fixed in Module 1).
**Fix:** `preflightBackupImport` now runs all three cross-reference validators against the imported payload and reports their findings as preflight errors/warnings. Added a regression test proving a template→missing-venue reference now fails preflight (with a recomputed checksum so the failure is attributable to the reference, not the hash).

## Cross-module dependencies affected
- **Backup import** — now rejects/ warns on broken references before apply.
- **Data integrity** — prevents importing templates/venues with dangling references that previously caused silent load failures.

## Validation
- Typecheck clean.
- Added `src/utils/backupImport.test.ts` cross-reference case.
- Full suite: **245 passed / 11 skipped** (was 244).
- Production build succeeds.

## Notes (verified healthy)
- Checksum verification, rollback snapshot, and replace-only mode all behave correctly.
- Validators sanitize/clamp imported values defensively (CSV-friendly, non-negative coords, dedupe).
