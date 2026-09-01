# Review #267 — Phase 4 Batch 5: FloorPlanCanvas / Layout Undo Deep Audit (4.7)

**Date:** 2026-09-01 · **Scope:** floor-plan console (FloorPlanCanvas 1890 ln) + the layout undo/redo machinery it drives (UndoRedoContext, useLayoutState persistence, AuthenticatedApp wiring) · **Baseline:** `bf18ea7` (#266, CI green)

## Method

Flow-level pass over the drag/pan/zoom state machine, palette drops and click-to-place coordinate math, keyboard nudge, undo/redo history semantics, and the layout persistence model (dirty tracking, explicit save, overwrite protection, unsaved-work guards).

## Findings

### F-267-1 (P4, FIXED): undo/redo history corrupts under React's updater double-invocation — Ctrl+Z restores twice, then "does nothing"

`UndoRedoContext` performed **nested state updates and side effects inside state updaters**: `pushSnapshot` called `setPast`/`setFuture` from within the `setCurrentSnapshot` updater, and `undo`/`redo` called `setFuture`/`setCurrentSnapshot`/`onRestore` from within the `setPast`/`setFuture` updaters. React requires updaters to be pure — **StrictMode double-invokes them in development (and this app runs `<StrictMode>` in main.tsx), while concurrent rendering may replay them in production**. Each double-invoke appended a **duplicate entry to the undo stack** and fired the `onRestore` side effect twice.

Proven live by a behavioral test that failed pre-fix: two pushes then one Ctrl+Z press called `onRestore` **2× instead of 1×**, and the full undo→redo round-trip **4× instead of 2×**. User-visible effect in dev: undo appears to need double presses (the second press "undoes" the duplicate and changes nothing on screen), and `MAX_HISTORY=50` actually holds ~25 real steps.

**Fix:** `currentSnapshot` was internal bookkeeping (never rendered, never exposed on the context) — it now lives in a **ref**, and all side effects are hoisted out of the updaters, which are now pure (deterministic given their input). Bonus: same-tick consecutive pushes are now handled correctly by construction (the ref tracks the newest snapshot immediately).

**Pinned by:** `src/contexts/UndoRedoContext.strictmode.test.tsx` — a real behavioral regression test (not a regex pin): renders the provider inside `<StrictMode>`, drives it via the typed event bus + keyboard events, asserts exactly-once restore per press and a clean undo→redo round-trip. Verified failing→passing around the fix.

## Verified clean (with evidence)

| Flow | Verdict |
|---|---|
| Drag state machine | Pointer listeners attach only while `dragState \|\| isPanning` with full cleanup (#263 pattern); pointer-up ends drag/pan; positions clamped ≥ 0. |
| Undo granularity | One snapshot per drag (`dragMovedRef` guards first real movement — click-to-select never pollutes history); each arrow-key nudge is a discrete undoable step; shift = 1, default 0.5. |
| Zoom/pan math | Wheel zoom is cursor-anchored (base coordinate recomputed and kept under cursor), zoom clamped 0.25–2, pan re-clamped; `clampPan` centers content smaller than the container and bounds user-driven pan. `wheel` listener `passive: false` + cleanup. |
| Coordinate conversion | `screenToVenue` (rect + scroll − pan) ÷ zoom ÷ scale with venue-origin offset — same math as the zoom anchor; exterior placement skips the origin offset; drop handler try/catches the dataTransfer JSON. |
| Click-to-place | Guards against in-progress drag/pan and item groups before placing; deselects otherwise. |
| Layout persistence | Explicit-save model: `layoutDirty` via baseline snapshot key; `beforeunload` guard + dirty checks on venue switch and layout load; `saveLayoutWithOverwrite` conflict protection (tested in `layoutSaveOverwrite.test.tsx`); history cleared on layout replacement so Undo can't restore across layouts. |
| Onboarding hint timer | 2.5s self-dismiss; cleanup drops the timer without flushing — correct (a user who unmounted early should see the hint again). |
| Auto-repair | `handleAutoRepair` awaits an emergency recovery snapshot before mutating (triaged #263: dep warning benign). |

## Gates

tsc 0 · vitest **1052 pass / 5 skip** (+2, both behavioral) · eslint 0 err / **28 warn** (baseline) · build gzip **546.64 kB** (≤620) · `npm audit --omit=dev` 0 · event-bus checker clean.

## Disposition

**4.7 (floor plan / layouts) → COMPLETE** — the last giant-file hotspot. Phase 4 console-flow audit now covers every 1800+ line component. Remaining Phase 4 protocol items: state-machine completeness and optimistic-update rollback (both substantially covered by these flow audits), unhandled rejections sweep, and the deferred P5 backlog (PlatformVenueMap Leaflet radius freeze, LodgingBuilder mid-drag staleness, PlatformVenueChatPanel unguarded poll, portal chat msgTick cadence, shift-time empty-string cosmetic).
