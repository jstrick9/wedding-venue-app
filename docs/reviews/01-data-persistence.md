# Module Review 01 — Data & Persistence Layer

**Scope:** `src/hooks/useLayoutState.ts`, `src/data/venueData.ts`, `src/utils/storage.ts`, `src/utils/collaboration.ts`, `src/utils/collaborationChannel.ts`, `src/utils/backupImport.ts`, `src/utils/backupExport.ts`, `src/utils/recovery.ts`, `src/constants/storageKeys.ts`, `src/constants/storageVersions.ts`

## Summary

This is the foundation of the whole app. Because every module reads/writes through this layer, correctness here prevents cascading failures everywhere else. Overall it is solid (versioned storage, corruption recovery, typed event bus, backup/restore), but there were several real defects and inconsistencies.

## Findings

### P1 — Built-in layout templates were broken out of the box
`defaultLayoutTemplates` reference venues `pavilion`, `ceremony-lawn`, and `cocktail-garden`, but `defaultVenues` was an **empty array**. Loading a template silently fell back to whatever venue was currently open, so templates never applied to the space they were designed for.
**Fix:** Seeded three realistic default venues matching those IDs (Grand Pavilion, Ceremony Lawn, Garden Cocktail Courtyard) with sensible dimensions/capacity/canvas. Added a regression test asserting every template venue is seeded.

### P1 — `resetToDefaults` was incomplete
It only reset venues, table specs, fixtures, guidelines, templates, users, linens, and decor items. It left **chair specs, wall styles, spacing, alignment, indoor/outdoor feature templates, and decor categories/arrangements/packages** at their current values — so a "Reset to Defaults" didn't actually reset defaults.
**Fix:** `resetToDefaults` now restores every persistence domain. Added a regression test that plants non-default values in every domain and verifies all are restored.

### P2 — Duplicate, dead storage constant with ghost keys
`types.ts` exported `DECOR_STORAGE_KEYS` that **no file imported**, and it contained ghost keys (`spm_decor_placed`, `spm_decor_groups`) that no code ever reads/writes. Two parallel constants for the same decor domains invites drift.
**Fix:** Removed `DECOR_STORAGE_KEYS`. The canonical keys in `constants/storageKeys.ts` are now the single source of truth.

### P2 — Saved layouts written raw during backup import (versioning inconsistency)
Saved layouts are read/written through the **versioned** storage layer (`collaboration.ts`, envelope `{version, savedAt, data}`), but `backupImport.applyBackupPayload` wrote them **raw** (plain array). After every import the loader treated the data as a legacy v0 bundle and re-migrated it — functionally self-healing but fragile and semantically wrong.
**Fix:** `backupImport` now writes saved layouts with `writeVersioned(...)` like the other versioned domains (config, messages, portal, RSVP).

## Cross-module dependencies affected
- **Admin Panel** ("Reset to Defaults" button) — now actually resets everything.
- **Template Selector / Header** (load template) — now resolves the intended venue.
- **Backup/Restore** — saved-layout round-trip is now consistent with the rest of the versioned domains.

## Validation
- Typecheck clean.
- Added `src/data/venueData.test.ts` (3 tests).
- Full suite: **237 passed / 11 skipped** (was 234).
- Production build succeeds.

## Deferred (larger architectural work, out of scope for this module)
- Unify the remaining **raw** storage domains (venues, tables, fixtures, users, etc.) onto the versioned envelope. This is a migration project of its own; the hardened raw layer (corrupt-backup + typed error events) from the prior commit mitigates the risk in the meantime.
- Decouple `useLayoutState` from being both a hook and the data-access service layer (would touch many callers).
