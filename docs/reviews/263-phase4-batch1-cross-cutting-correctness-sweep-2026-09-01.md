# Review #263 — Phase 4 Batch 1: cross-cutting correctness sweep (row 4.13 core + portal-sync fix)

**Date:** 2026-09-01 · **Mode:** continuous campaign · One finding (F-263-1, P4, fixed). Three sweeps, all codebase-wide; this batch covers the event-bus and hooks half of row 4.13 — the stores/race half remains.

## Sweep 1 — Event-bus listener cleanup (31 `on('spm_*')` sites): CLEAN

Every call site uses the typed bus's auto-cleanup correctly: `useEffect(() => on(...), [])`, `return on(...)` from effects, or collected `offs[]` arrays unsubscribed in the effect teardown (AuthenticatedApp's modal wiring). Eight heuristic suspects were all false positives on direct inspection. The bus itself (`on()` returning `removeEventListener`) is sound.

## Sweep 2 — Raw `addEventListener` cleanup (44 sites): CLEAN

File-level add/remove balance holds everywhere. Two apparent mismatches are both correct by construction: `appEvents.ts:213` is the `on()` implementation itself (add + returned remove with variable names), and `supabaseClient.ts:43` attaches to an `AbortSignal` (garbage-collected with the signal, not a window leak).

## Sweep 3 — React hooks lint surface (the "known 7 conditional-hooks files")

**Zero `react-hooks/rules-of-hooks` errors exist today** — the 7-file conditional-hooks false-positive cluster recorded earlier in the campaign no longer applies (superseded by later phases' rewrites). The live surface is **28 `exhaustive-deps` warnings**, all triaged individually:

### F-263-1 (P4 — fixed): stale-`venueSlug` portal pollers

The CouplesPortal cloud-sync effect (deps `[cloudToken, event?.id, session?.eventId]`) and the GuestPortal hydration effect (deps `[coupleEventId, guestToken, isCouplePortal]`) both closed over the `venueSlug` prop without listing it. Both portals derive the slug from the URL hash **at render time**, so following another venue's link swaps the prop without remounting the component — and the 5-second pollers kept hydrating (and the couple portal kept saving snapshots, post-#258 through `saveCouplePortalSnapshot(..., venueSlug, ...)`) against the **previous venue** until a remount. Both effects now list `venueSlug` and re-subscribe on change. Pinned by `src/components/portalSyncDeps.pin.test.ts` (2 tests).

### Remaining 26 warnings — declined, with written reasons

- **Stable by construction (10):** missing deps that are `setState` functions (`setSelectedId`, `setEditingArrangementId`), module-level constants (`EVENT_ROLES_STORAGE_KEY`, `EVENT_QUESTIONS_STORAGE_KEY`), or values derived from module constants (`CustomVenueBuilder.toCanvas` over `workspaceWidth`).
- **Transitively fresh (9):** `useLayoutState()` returns a fresh object every render, so every `[layoutState]` callback re-memoizes each render and captures a fresh `pushUndoSnapshot`/`handleAutoRepair` (AuthenticatedApp 318/656/704/717, 351); `useDirectMessages`/`EventQuestionsWizard` recompute when the data dep changes, refreshing the closures over it.
- **Intentional dep design (3):** `CouplesPortal:394` uses `activeTab === 'chat'` + `event?.id`, which covers exactly the changes the interval cares about (the "complex expression" warning is style-only).
- **Perf-only unnecessary deps (6):** `showAdmin`, `pkgTick` ×2, `vendors` ×2, `coupleEvents`, `cursor` — extra recompute, no correctness impact; removing them would be cosmetic churn.
- **P5 deferred to the hotspot pass (1):** `PlatformVenueMap:133` — the Leaflet markers' selected radius freezes at map-build time (`selectedId` unlisted). Selection still works (popup, detail card, and the SVG fallback view all update); only the Leaflet circle size fails to move. Proper fix is marker refs + a `selectedId` effect, to be done in the 4.7/4.1 flow pass rather than a drive-by.
- **P5 mid-drag bounded staleness (1):** `LodgingBuilder:230` — drag handlers capture `snap`/`updateFurniture`/`updateRoom` unlisted, but the drag-state deps change during the drag, refreshing the closures.

## Gates

tsc + strict unused-locals scan clean (non-test) · eslint 0 errors / **28 warnings** (−2) · vitest **1041 passed** / 5 skipped (+2) · single-file 546.51 kB gzip + split chunks within budget · audit clean.

## Registry delta

Row 4.13 → `in-progress` (event bus + hooks halves done with evidence; stores/races remain). Rows 4.10/4.11 note the F-263-1 fix. Next: the stores/race half of 4.13, then the giant-file console flows (4.10 CouplesPortal deep pass, 4.11 GuestPortal, 4.9 StaffOperationsPanel, 4.7 FloorPlanCanvas).
