# Module Review — 01: Data & Persistence Layer

**Scope:** `src/hooks/useLayoutState.ts`, `src/data/venueData.ts`, `src/utils/storage.ts`, `src/utils/collaboration.ts`, `src/utils/collaborationChannel.ts`, `src/utils/backupImport.ts`, `src/utils/backupExport.ts`, `src/utils/backupTypes.ts`, `src/utils/recovery.ts`, `src/utils/recoveryDiagnostics.ts`, `src/constants/storageKeys.ts`, `src/constants/storageVersions.ts`

## Summary

This is the foundation of the whole app. Because every module reads/writes through this layer, correctness here prevents cascading failures everywhere else. Overall it is solid (versioned storage, corruption recovery, typed event bus, backup/restore), but there were several real defects and inconsistencies. The fixes below were contributed by two complementary review passes over the same module.

## Findings

### Critical — Backup restores silently lose versioned data (direct messages, guest portal config/guests, RSVP submissions)
`buildBackupBundle` read `DIRECT_MESSAGES`, `PORTAL_CONFIG`, `PORTAL_GUESTS`, `RSVP_SUBMISSIONS` with the raw helper `readJson(...)`. All four are stored as **versioned envelopes** `{version, savedAt, data}`. So `readJson` captured the **envelope**, not the data. On restore, `applyBackupPayload` passed that envelope into `writeVersioned`, producing a **double-wrapped** envelope; when read back, the versioned loader returns `envelope.data` = the inner envelope (an object), which `normalize` (checks `Array.isArray`) silently collapses to `[]`/`null`.

**Result:** After a backup → restore, direct messages, guest-portal config, portal guests, and RSVP submissions were **silently wiped**.
**Fix:** All domains are now exported through their accessors (unwrapped) via a single registry. A round-trip regression test (`backupRoundtrip.test.ts`) proves the data survives.

### High — Built-in layout templates were broken out of the box
`defaultLayoutTemplates` reference venues `pavilion`, `ceremony-lawn`, `cocktail-garden`, but `defaultVenues` was an **empty array** — templates never applied to the space they were designed for.
**Fix:** Seeded three realistic default venues matching those IDs. Regression test asserts every template venue is seeded.

### High — Backups exported chair/wall/spacing settings but never restored them
`BackupPayload` declared `chairSpecs`, `wallStyles`, `spacingSettings` and `buildBackupBundle` exported them, but `applyBackupPayload` never wrote them back → lost on import.
**Fix:** Restored via the registry.

### Medium — Alignment + indoor/outdoor feature templates missing from backup/recovery
`alignmentSettings`, `indoorFeatureTemplates`, `outdoorFeatureTemplates` were neither exported, nor restored, nor in `RECOVERY_DOMAINS`.
**Fix:** Added to backup export, restore, and the corruption-health check.

### Medium — `resetToDefaults` was incomplete
It only reset a subset of domains, leaving chairs, wall styles, spacing, alignment, feature templates, and decor categories/arrangements/packages untouched.
**Fix:** Now restores every persistence domain. Regression test plants non-defaults in all domains and verifies all are restored.

### Medium — Duplicate, dead storage constant with ghost keys
`types.ts` exported `DECOR_STORAGE_KEYS` that no file imported, with ghost keys (`spm_decor_placed`, `spm_decor_groups`) nothing reads/writes.
**Fix:** Removed it; `constants/storageKeys.ts` is the single source of truth.

### Medium — Saved layouts written raw during backup import (versioning inconsistency)
Saved layouts go through the versioned layer, but `applyBackupPayload` wrote them raw, triggering a legacy-migration self-heal on every load.
**Fix:** Versioned domains (config, saved layouts, messages, portal, RSVP) are all written as envelopes via the registry.

### Incomplete — `merge` mode was declared but unimplemented
`applyBackupPayload(payload, 'merge')` threw `"Only replace mode is currently supported."`
**Fix:** Implemented `merge` (arrays → id-dedup concat; objects → shallow merge; incoming wins).

### Quality — Hand-maintained parallel domain lists had already drifted
Domains were maintained in four places (`BackupPayload`, `buildBackupBundle`, `applyBackupPayload`, `RECOVERY_DOMAINS`), which is the root cause of the backup bugs above.
**Fix:** New single source of truth `src/utils/backupDomains.ts`; export, import, and recovery all derive from it. A consistency test fails if a domain drifts out of recovery coverage.

## Changes implemented
- `src/utils/backupDomains.ts` (new) — single domain registry with read/write for every persistent domain.
- `backupExport.buildBackupBundle` — reads every domain through the registry (fixes versioned envelope bug, adds missing domains).
- `backupImport.applyBackupPayload` — restores every domain via the registry; implemented `merge` mode.
- `recovery.RECOVERY_DOMAINS` — derived from the registry so all design domains are covered.
- `useDirectMessages.getStoredDirectMessages()` — exported non-hook accessor for backup.
- `venueData` — seeded default venues; `resetToDefaults` completes all domains; removed dead decor constant.

## Cross-module dependencies affected
- **Admin Panel** ("Reset to Defaults", Backup/Restore UI) — now actually resets/restores everything.
- **Template Selector / Header** (load template) — now resolves the intended venue.
- **AuthenticatedApp** (safe-mode recovery) — health/recovery now covers the full domain set.

## Validation
- Typecheck clean; event-bus lint clean.
- New/updated tests: `backupRoundtrip.test.ts`, `backupExport.test.ts`, `backupImport.test.ts`, `venueData.test.ts`.
- Full suite green (239 passing / 11 skipped at time of write).

## Deferred (larger architectural work)
- Unify the remaining **raw** storage domains (venues, tables, fixtures, users, etc.) onto the versioned envelope — a migration project of its own.
- Decouple `useLayoutState` from being both a hook and the data-access service layer.
