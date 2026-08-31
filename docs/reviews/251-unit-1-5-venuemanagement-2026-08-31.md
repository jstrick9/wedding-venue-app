# Review #251 (cont.) — Phase 1 Unit 1.5: `admin/VenueManagement.tsx` (1,162 → 903 lines)

**Date:** 2026-08-31 · **Mode:** continuous campaign

**Findings: none new.** The file carried the standard clone-stamp damage — 57 invalid destructure names (same list, including the phantom `FileReader`/`alert`) and 197 unused bindings — but its body never touched a phantom name and produced **zero** `tsc` errors once the garbage was removed. This is the first big panel where the suppression hid only mess, not malice.

Types import pruned 15 → 4 (`LayoutCategory`, `PatternType`, `ShapeType`, `Venue`). No pinning test added (nothing new to pin; the ratchet + strict scan enforce the state).

**Gates:** tsc + strict scan clean · eslint 0 errors / 30 warnings · vitest 1012 passed / 5 skipped · single-file 554.73 kB gzip + split chunks within budget · audit clean · ratchet 18 → **17**.

**Registry delta:** row 1.5 → `done` (#251). Phase 1: 7/24. Next: 1.6 `TableManagement.tsx` (1,161).
