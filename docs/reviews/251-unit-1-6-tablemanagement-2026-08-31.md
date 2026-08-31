# Review #251 (cont.) — Phase 1 Unit 1.6: `admin/TableManagement.tsx` (1,161 → 916 lines)

**Date:** 2026-08-31 · **Mode:** continuous campaign

## Findings

**F-251-4 (P1 functional bug — fixed): "Venue Category Availability" chips on tables never worked.** Identical clone of F-251-2: the onClick computed the next `venueCategories` array and then saved the tables list unchanged (`{ ...t }`), discarding the value. The UI instructs "Choose which venue categories can use this table. Leave all unchecked to allow in all categories." — the chips did nothing, ever. Fixed: `{ ...t, venueCategories }` applied to the edited table.

**Blast radius scanned:** `const venueCategories = selected` exists in exactly two files repo-wide — FixtureManagement (F-251-2, fixed) and this one. The broken-toggle clone is now fully eradicated.

Clone-stamp cleanup: 57 invalid + 183 unused destructure names removed; types import 14 → 6.

## Pinned by

`TableManagement.typing.test.ts` (2 tests): toggle applies the computed value; no global shadowing.

## Gates

tsc + strict scan clean · eslint 0 errors / 30 warnings · vitest **1014 passed** / 5 skipped (+2) · single-file 552.81 kB gzip + split chunks within budget · audit clean · ratchet 17 → **16**.

## Registry delta

Row 1.6 → `done` (#251). Phase 1: 8/24. Next: 1.7 `VenueDashboard.tsx` (957).
