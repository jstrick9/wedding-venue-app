# Module Review 06 — Collision Detection & Layout Validation

**Scope:** `src/utils/collisionDetection.ts`, `src/hooks/useLayoutState.ts` (warnings wiring), `src/components/AuthenticatedApp.tsx` (warnings banner), `src/utils/collisionDetection.test.ts`.

## Summary

The collision engine is correct and well-tested: `getTableBoundingBoxWithChairs` accounts for chair layouts per table shape, `checkTableCollision`/`checkFixtureCollision` enforce wall + item + fixture spacing at placement time (with toasts), lodging/exterior fixtures correctly opt out of spacing rules, and `boxesOverlap` uses an epsilon-safe comparison. The gap was that the layout-warnings **feature was declared but never built out**.

## Findings

### P2 — Layout-warnings feature was dead scaffolding
`validateLayout()` (computes a warning map for every table/fixture in the current layout) and the `warnings` state in `useLayoutState` were both declared but **never wired together and never displayed**. `warnings` was initialized to `[]`, only ever reset, and returned — with **no consumer** in `AuthenticatedApp`. So a layout that violated spacing rules after the fact (e.g. fixtures moved by a less careful edit, or a loaded master layout) produced no persistent signal; collisions were only caught at the moment of placement.
**Fix:**
- `useLayoutState` now recomputes `warnings` from `validateLayout(...)` whenever the layout tables/fixtures/venue change and maps them to the `ValidationWarning[]` shape (wall/spacing issues).
- `AuthenticatedApp` renders a **"N layout warnings"** banner over the canvas when any exist, listing the first few issues. This turns the dead state into a live, working layout-health summary.
- Added unit tests for `validateLayout` (flags a wall violation, reports none for a clear layout).

## Cross-module dependencies affected
- **Layout canvas** — persistent warning banner now visible; placement-time toasts still work.
- **useLayoutState** — `warnings` is now a live computed field.

## Validation
- Typecheck clean.
- Added 2 `validateLayout` tests.
- Full suite: **247 passed / 11 skipped** (was 245).
- Production build succeeds.

## Notes / recommendations
- Consider also reflecting capacity warnings in the same banner in a future pass (the capacity badge already turns red when over capacity).
- `validateLayout` currently covers table-vs-table + wall spacing and fixture-vs-wall; placement-time checks are more complete. The banner is a summary, not a replacement for the interactive guardrails.
