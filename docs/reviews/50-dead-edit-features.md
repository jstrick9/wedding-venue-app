# Review 50 — Dead edit features & dead-code sweep

Autonomous gap-hunting pass. Used a temporary `tsc --noEmit --noUnusedLocals` scan
across the whole codebase (the shipped config has `noUnusedLocals: false`, so these
were invisible to normal CI) plus targeted import-graph analysis to surface
"wired but never rendered" dead features and dead modules.

## Findings & fixes

### 1. Image preview was set-but-never-rendered (bug)
`AuthenticatedApp` exposed `onViewImage={(url,title) => setImagePreview(...)}` to
the Sidebar, FloorPlanCanvas and PropertiesPanel, but the `imagePreview` value was
never rendered — clicking any "view image" action silently did nothing.
**Fix:** render a lightbox (`CenteredModal` + `<img>`) when `imagePreview` is set.

### 2. Vendor "✏️ Edit" button was a dead button (bug)
`VendorPanel` had an Edit button that set `editingVendor`, but nothing rendered it,
and `updateVendor` was never called. Clicking Edit did nothing.
**Fix:** implemented the full vendor edit modal (name, category, contact, email,
phone, website, contract amount, contract-signed/deposit/preferred toggles, rating,
notes) wired to `updateVendor`, with close/save/cancel. Added regression tests.

### 3. Timeline event editing was missing (feature gap)
`TimelinePanel` could add/delete/toggle events but not edit them; `updateEvent` was
exposed by `useTimeline` yet unused.
**Fix:** added an event edit pencil + modal (title, time, category, location, notes)
wired to `updateEvent`. Added regression tests.

### 4. Password reset code-expiry countdown was computed-but-hidden (bug)
`PasswordReset` ran a live countdown interval writing `timeRemaining`/`codeGenerated`
every second, but neither value was displayed (and `formatTime` was dead). Users saw
no expiry or expired state.
**Fix:** restored the state and surfaced a live "Code expires in m:ss" indicator plus
an expired-warning message; removed the dead `formatTime` and the now-truly-dead
duplicate `timeRemaining`/`codeGenerated` confusion.

### 5. Dead module removed: `services/DatabaseService.ts`
A 196-line early Supabase client (`export const db`) superseded by the platform
repository workstream (`services/repository/*`, `services/backend/*`). Not imported
anywhere. Removed.

### 6. Permission gates computed but not enforced (hardening)
`canOpenGuestPanel`/`canPrintCurrentLayout` were computed in `AuthenticatedApp` but
never applied, so the Guests and Print modals were only gated by modal state, not
permission (Header gates the entry buttons, but this left a defense-in-depth hole).
**Fix:** applied the gates to the modal renders.

### 7. Dead code sweep
- `useLayoutState.parseCsvLine` — dead (CSV parsing lives in `utils/guestCsv.ts`).
- `rbacBridge.PERMISSION_TO_FLAG` — dead lookup that the resolver's inline logic
  supersedes (map can't express OR cases).
- `imageStorage` top-level `uploadObject` — shadowed by a dynamic import.
- Unused imports: `AuthenticatedApp` (LayoutTemplate, PlacedTable, PlacedFixture,
  getSpacingSettings, SafeImage, ModalDialog, UndoRedoToolbar), `AdminPanel`
  (ReactNode, ChairType), `LiveRegion` (useCallback), `MultiImageUpload`
  (getPlatformProvider), `useRBAC` (useMemo, getChildPermissions), `TimelinePanel`
  (React, TimelineDay), `ModalContext`/`UndoRedoContext`/`UndoRedoToolbar`
  (unused React default), and five test files (unused `waitFor`/`within`/`vi`/`React`/
  `select`).

## Validation
- `npm run typecheck` clean.
- `npx tsc --noEmit --noUnusedLocals` clean across the entire codebase (non-test + test).
- `npm run lint:events` clean.
- `npx vitest run`: 307 passed / 11 skipped (was 302; +5 from new edit tests).
- `npm run build` green (~1.32 MB / ~299 KB gzip).
