# Module Review — 08: Layout Canvas & Design Interaction

**Scope:** `src/components/FloorPlanCanvas.tsx`, `src/components/AuthenticatedApp.tsx` (canvas wiring), `src/contexts/UndoRedoContext.tsx` (interaction), `src/hooks/useLayoutState.ts`

## Findings

### BUG-1 (UX, High) — Zoom did not anchor to the cursor
`handleWheel` changed the zoom factor around a fixed center. In a floor-plan tool users expect to zoom into the point under their mouse (standard in CAD/design tools). Without it, zooming around a large venue feels disorienting.
**Fix:** Zoom is now anchored to the cursor — the content point under the mouse stays under the mouse as you zoom (recomputes `panOffset` proportionally).

### BUG-2 (UX, Medium) — Canvas could be panned entirely out of view
Pan had no bounds, so users could scroll the venue completely off-screen and "lose" it.
**Fix:** Added `clampPan()` that keeps the canvas within the container (center when it fits; bounded when it overflows). Programmatic fit/reset calls are unaffected.

### BUG-3 (Accessibility, Medium) — Canvas items had no keyboard/screen-reader support
Table/fixture `<g>` groups only responded to `onMouseDown`. Keyboard-only users couldn't select or move items — inconsistent with the app's otherwise strong a11y work (focus traps, live regions, ARIA tabs).
**Fix:** Item groups now expose `role="button"`, `tabIndex={0}`, `aria-label`, `aria-pressed`; Enter/Space selects, and **arrow keys nudge** the item (Shift = 1 ft, plain = 0.5 ft). Delete/Backspace remains global.

### BUG-4 (UX, High) — Dragging an item flooded the undo stack
`onMove` (canvas drag) called `pushUndoSnapshot()` on **every mousemove**, so a single drag created dozens-to-hundreds of micro-steps against the 50-entry undo history — Undo after a drag rewound pixel-by-pixel.
**Fix:** One undo snapshot is now pushed at the **start of the first actual movement** of a drag (via a new `onDragStart` hook), so a whole drag undoes as one step. A mere click-to-select no longer pollutes history. Each discrete arrow-key nudge pushes one snapshot (so nudges undo one step at a time).

## Cross-module dependencies affected
- `AuthenticatedApp` — passes the new `onDragStart={pushUndoSnapshot}` to the canvas; removed per-move undo pushes from `handleMoveItem`.
- `UndoRedoContext` — unchanged; benefits from the reduced snapshot rate.
- Guest portal / other consumers: `FloorPlanCanvas` is only used by `AuthenticatedApp`; the new `onDragStart` prop is optional so nothing else is affected.

## Validation
- Typecheck clean; full suite **253 passed / 11 skipped**; production build succeeds.

## Deferred / note
- Middle/Shift-drag to pan is the only pan gesture today (left-drag on empty canvas just deselects). Adding left-drag-to-pan would be a further UX win but risks conflicting with item placement/drag-from-sidebar, so it's left for a dedicated pass.
