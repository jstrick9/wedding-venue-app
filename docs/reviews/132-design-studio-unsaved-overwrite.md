# 132 — Design Studio: unsaved-changes guard + Save Layout overwrite

## 1. Unsaved-changes guard when leaving the Studio
The working canvas layout is in-memory until explicitly saved (named layout or
venue master). It could be lost on refresh/close, logout, or navigating away.

**Dirty tracking (`useLayoutState`):**
- Added `layoutDirty` state + `markLayoutClean()`, driven by a content snapshot
  of tables/fixtures/decor compared against a clean baseline.
- Baseline is (re)established on initial load, venue switch, save, load-layout,
  load-template, and save-master.

**Guard (`AuthenticatedApp`):**
- A `guardStudioLeave(action)` helper intercepts navigation away from the Studio
  (Dashboard, Admin, Venue Map, logout). If `layoutDirty`, a ConfirmDialog asks
  before discarding.
- The breadcrumb shows a "● Unsaved" badge while dirty.
- A `beforeunload` handler warns on browser refresh/close when dirty.

## 2. Save Layout offers overwrite (instead of only creating duplicates)
- Added `saveLayoutWithOverwrite(name)` to `useLayoutState`: if a saved layout
  with the same name exists (case-insensitive), it updates that layout in place;
  otherwise it creates a new one. Both save paths clear the dirty flag.
- The Header's **Save Layout** dialog now detects a name collision and shows two
  actions: **Save as new copy** (old behavior) and **Overwrite existing**
  (updates in place). A warning explains the choice.

## 3. Bonus bug fix — double clear confirmation
`clearLayout()` contained a native `window.confirm`, but the Sidebar already shows
a `ConfirmDialog` before calling it — producing a double prompt. Removed the
native confirm; confirmation is now handled once by the Sidebar.

## Tests
- `Header.test.tsx` (+1): typing an existing name shows "Overwrite existing" and
  calls `onSaveLayoutOverwrite`.
- `src/hooks/layoutSaveOverwrite.test.tsx` (new, 2): overwrite updates in place
  (no duplicate, content updated) + `layoutDirty` toggles on edit and clears on save.

## CI
581 passing / 11 skipped (was 578). Typecheck, event-bus lint, unused-locals, and
single-file build all green.

## Files
- `src/hooks/useLayoutState.ts`
- `src/components/AuthenticatedApp.tsx`
- `src/components/Header.tsx`
- `src/components/Header.test.tsx`
- `src/hooks/layoutSaveOverwrite.test.tsx` (new)
