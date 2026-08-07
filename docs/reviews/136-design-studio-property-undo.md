# 136 — Design Studio: make property-panel edits and design-application undoable

## Gap
Drag/move, keyboard Delete/Duplicate/nudge, and Clear-All push an undo snapshot,
but **property-panel edits** (label, linen color, chair count, applied design) and
**applying a saved decor design** (dropping a design onto a table) did not — so a
venue admin couldn't Undo those changes.

## Fix
- **Coalesced undo for property edits.** `handleUpdateTableSafe` /
  `handleUpdateFixtureSafe` now push an undo snapshot for metadata/property
  updates (previously only position moves did). A `pushPropertyUndo` helper
  coalesces rapid edits to the same item within an 800ms window so typing a label
  is ~1 undo step instead of one per keystroke. Position updates keep the existing
  discrete undo.
- **Design application is undoable.** Dropping a saved decor arrangement onto a
  table now pushes an undo snapshot before applying it.

Now every edit a venue admin makes on the canvas (place, move, nudge, delete,
duplicate, resize, clear, property edits, and applying a design) is undoable.

## Files
- `src/components/AuthenticatedApp.tsx`

## CI
592 passing / 11 skipped (unchanged count; no new test files needed — behavior
wired through existing handlers).
