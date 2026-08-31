# Review #249 — Defect-Elimination Campaign Launch: Protocol, Registry, Phase 1 Units 1.1 / 1.23 / 1.24

**Date:** 2026-08-31 · **Scope:** campaign infrastructure + first three Phase-1 units · **Mode:** continuous, live+throwaway verification, risk-density order (operator decisions recorded in the protocol header).

## §1 Campaign infrastructure

- `docs/qa/defect-elimination-protocol.md` (v1.0): the phases, the unit loop, the honest convergence definition ("every registry row carries evidence", not "no bugs exist"), live-throwaway operating rules, and the residual-risk floor.
- `docs/qa/COVERAGE-REGISTRY.md`: the finite surface — 24 type-blind files, 46 RPCs, 29 tables × 5 role classes, 4 consoles' flows, 3 Edge Functions, 8 cross-cutting sweeps, drift checks, 6 E2E journeys, plus the batched artifact-request board. **This file is the campaign's source of truth**; every unit ends with its row updated and evidence cited.

## §2 Unit 1.1 — `admin/shared/AdminSharedComponents.tsx` (261 lines)

**Finding F-249-1 (latent, now fixed): the file referenced eight type names that were never imported** — `RectangularChairLayout`, `PlacedTable`, `PlacedFixture`, `LayoutCategory`, `LayoutTemplate`, `ShapeType`, `PatternType`, `PatternColors` — invisible for the file's entire life under `@ts-nocheck`. Typed now via `import type` from `src/types.ts`; repo-wide `tsc --noEmit` is clean.

Also restructured the `BrandedStatCard` polymorphic render (`Comp = onClick ? 'button' : 'div'` + `type={...}` prop) into an explicit two-branch render — behavior-identical (div never received a `title`; button always `type="button"`), but now type-safe instead of relying on `@ts-nocheck` to not notice that a `div` was receiving a `type` attribute.

**Finding F-249-2 (maintainability defect, registered not fixed — Phase 6.8/Phase 4): mixed adoption of the shared components.** 8 files import from `AdminSharedComponents` (BackupManagement, CoupleManagement, EventQuestionsManagement, GuestPortalManagement, PackageManagement, VenueWayfindingManagement, StudioLayoutsHome, AdminPanel.highDensity.test) while ~13 admin panels carry **private duplicate copies** of `BrandedSectionHeader`/`BrandedStatCard`/`BrandedTips`/`PatternColorPicker`. Consequence: a fix or a11y improvement to the shared component does not propagate to the duplicated panels — they can (and presumably already do) diverge. Also noted (then fixed): three dead non-exported consts in the shared file (`chairLayoutOptions`, `shapeOptions`, `patternOptions`) — initially left in place, which **failed CI's "Strict unused-locals scan" step** (`tsc --noUnusedLocals`, non-test files) on the first push of ed05148: `@ts-nocheck` had been hiding them too. Removed in the follow-up commit along with their now-unused type imports. Two campaign lessons codified: (1) **the gate chain is whatever `ci.yml` runs — enumerate it from the workflow file, not from habit** (the strict scan wasn't in my local routine); (2) de-nochecking a file makes its dead locals fail CI — delete them, don't carry them.

**Process near-miss (recorded as a campaign rule):** an initial grep concluded the file was dead code; it was deleted; `tsc` immediately surfaced 8 importers and the deletion was reverted before commit. Lesson codified: **grep output is not evidence — compiler/test output is.** No registry verdict without the toolchain.

## §3 Units 1.23 / 1.24 — `SeatingAndLinensManagement.tsx` (55) and `StructuresManagement.tsx` (51)

Simple live wrappers (imported by `AdminPanel.tsx`). Both de-nochecked; `tsc` clean; no defects found. These were done early because they're tiny and low-risk, closing 2 rows quickly.

## §4 Ratchet

`@ts-nocheck` ceiling: 24 → **21** (`MAX_TS_NOCHECK_FILES` + baseline test updated). Rule held: ceiling == open count.

## §5 Verification

| Gate | Result |
|---|---|
| ESLint | 0 errors / 30 warnings (baseline) |
| Strict unused-locals scan (`tsc --noEmit --noUnusedLocals`, non-test) | clean (after dead-const removal — this step caught the first-push failure) |
| `tsc --noEmit` | clean (whole repo, 3 files newly checked) |
| Vitest | 1002 passed / 5 skipped (unchanged count — no behavior change) |
| Build single/split + budgets | 556.99 kB gzip / chunks within budget |
| `@ts-nocheck` ratchet | 21 / 21 |
| `npm audit --omit=dev` | 0 vulnerabilities |

## §6 Registry delta

Rows 1.1, 1.23, 1.24 → `done` (#249). Row 6.8 gains the shared-component-duplication finding. Phase 1 progress: 3/24.

## §7 Next (continuous)

Units 1.2 (`UserManagement.tsx`, 1825) → 1.3 (`BrandingManagement.tsx`, 1716) → … in registry order. Artifact requests on the registry board are only needed from Phase 3 onward; nothing blocks Phase 1.
