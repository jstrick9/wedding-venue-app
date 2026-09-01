# Review #266 — Phase 4 Batch 4: StaffOperationsPanel Deep-Flow Audit (4.9)

**Date:** 2026-09-01 · **Scope:** deep flow audit of the staff operations console (2061 ln) — tasks/kanban, areas, shifts/timeline, checklists, BEO, export/import · **Baseline:** `5ba68b9` (#265, CI green)

## Method

Flow-level pass over every mutating surface: CRUD handlers (permission-gated?), confirm dialogs (stale captures?), shift scheduling (conflict handling), import/export round-trip (shape safety), BEO generation (null safety), plus a codebase-wide `createObjectURL` leak sweep.

## Findings

### F-266-1 (P4, FIXED): operations JSON import accepts non-array data → corrupted task list or crash on confirm

The import staged `data.tasks`/`areas`/`shifts` after only a truthiness check on `data.tasks`. A hand-edited, truncated, or foreign JSON file with e.g. `{"tasks": "hello"}` flowed into `[...pendingImport.tasks, ...tasks]` on confirm: **strings spread char-by-char** (five garbage "task" entries `h`,`e`,`l`,`l`,`o` persisted into the task store — no validation on the persist path either) and **objects throw a TypeError** (`[...{a:1}]`), crashing the confirm handler mid-save. Note the contrast: `loadData`'s parser validates `Array.isArray` and even backs up corrupt data — the import path skipped all of that.

**Fix:** coerce all three through an `Array.isArray` guard, reject the file with a warning toast when nothing valid is found (also fixes silent no-op on `{"areas":[...]}`-only files, which previously did nothing with no feedback).

### F-266-2 (P5, FIXED): file input never reset — re-importing the same file silently no-ops

`onChange` didn't clear `e.target.value`, so picking the same file a second time (e.g. after fixing it, or after a failed import) fired no event at all. Fixed: reset the input immediately after capturing the file.

### F-266-3 (P5, FIXED): export leaks the blob object URL every click

`URL.createObjectURL(blob)` with no `revokeObjectURL`. The download is already initiated by `a.click()`, so the URL is released immediately after. **Codebase sweep:** 9 `createObjectURL` sites; 8 revoke correctly (layoutExport deferred via 1s timeout — legit Safari pattern; recoveryDiagnostics immediately) — this was the only leak.

**Pinned by:** `src/components/staffOpsImport.pin.test.ts` (3 tests: shape validation + empty rejection, input reset, revoke inside handleExport).

## Verified clean (with evidence)

| Flow | Verdict |
|---|---|
| Persistence pattern | `loadData` (mount + `spm_data_changed`) parses defensively, backs up corrupt payloads, never crashes; `saveTasks/Areas/Shifts` = setState + persist + emit. The save→emit→own-reload echo is idempotent (no loop). |
| CRUD handlers | All gated by `canMutateOperations`; update paths stamp `updatedAt/updatedBy` and set `completedAt/completedBy` only on the not-completed→completed transition. |
| Confirm dialogs | `pendingDelete` captures only `{kind,id}`; confirm filters the **live** arrays (no stale capture). Area delete scrubs `assignedAreas` references from tasks (referential integrity); shift delete clears selection. |
| Import merge | Prepends imported records to live arrays; up to 3 emits per confirm is benign (idempotent reloads). |
| Shift conflicts | `isShiftConflicting` (overlap interval math on same staff) **surfaces** conflicts in overview banner, shifts tab badge, and per-row markers — warn-by-design (coordinators may intentionally soft-overlap), consistent since inception. |
| Timeline/shift editor | datetime-local conversion via tested `toLocalDatetimeInput`/`fromLocalDatetimeInput` (no TZ shift). Clearing a time stores `''` → NaN comparisons are false in conflict math (no crash); self-heals on re-edit — P5 declined. |
| BEO tab | Empty-state when no couple events; falls back `beoCoupleId || first`; reads fresh per render. |
| Checklist flows | Toggles/adds/removes route through `handleUpdateTask` (gated, stamped); reset flow unchecks items and demotes completed tasks — matches its confirm copy. |
| Async surface | **Zero** async code in the panel — no race surface. `handleLoadAdminDefaults` mutates a checklist array in place, but the same object reference is what gets saved — consistent, benign (P5 note only). |
| Date.now() IDs | `task-/area-/shift-<ms>` — collision needs two adds within the same millisecond; separate click events always see post-render state. Benign. |

## Gates

tsc 0 · vitest **1050 pass / 5 skip** (+3) · eslint 0 err / **28 warn** (baseline; my own pin test briefly tripped `no-regex-spaces` and `unused-vars`-adjacent patterns — fixed in-test, lesson recorded) · build gzip **546.65 kB** (≤620) · `npm audit --omit=dev` 0 · event-bus checker clean.

## Disposition

**4.9 (StaffOperationsPanel) → COMPLETE.** Next per risk density: 4.7 (FloorPlanCanvas, 1890 ln) — the last giant-file hotspot. P5 backlog unchanged (PlatformVenueMap Leaflet radius freeze, LodgingBuilder mid-drag staleness, PlatformVenueChatPanel unguarded poll, portal chat msgTick cadence, shift-time empty-string cosmetic).
