# 130 — Venue Map module: venue-admin persona fixes & UX gaps

As a venue admin, I exercised every control in the Interactive Venue Map module
(`#/venuemap` → `VenueMapDesigner` → `VenueMapCanvas`) and fixed the bugs and
gaps found.

## Bugs fixed
1. **Palette kind was never used for placement (dead control).**
   `VenueMapCanvas.handleSvgClick` hardcoded `onPlacePoint('space', …)`, so
   choosing Parking / Entry / Amenity in the palette and clicking the canvas
   still placed an **Event Space**; the palette only changed its own highlight.
   Added a `placeKind` prop (default `'space'`) and the designer now passes
   `placeKind={activeKind}`, so the palette actually drives placement.
2. **"Unsaved changes" indicator was unreliable.** It only appeared after placing
   a new point; editing an existing point's label/kind/coords/GPS never flagged
   the draft. All point-field edits now go through `editSelected()`, which sets
   `editing=true` so the "Save point" warning is honest.
3. **Deleting a point left orphaned <2-point routes.** `removeMapPoint` pruned a
   point from routes but kept routes that could no longer render; it now drops
   any route that falls below 2 points.

## UX improvements
4. **Map coverage panel.** Lists every venue (spaces + lodging) without a linked
   space pin, with a count (`X/Y pinned`) and a one-click **"+ Add pin"** that
   places a labeled pin near center for that venue and selects it so the admin
   can drag it into place. Previously there was no way to know which venues were
   invisible to couples on their drill-in map.
5. **Auto-label on venue link.** Linking a point to a venue now replaces a generic
   default label ("Event Space 3") with the venue's name.
6. **Route-building feedback.** Pins added to the in-progress walkway are now
   highlighted with a brand-colored dashed ring on the canvas, and the builder
   shows the ordered list of route points with per-point remove.

## Tests
- `VenueMapCanvas.test.tsx` (new, 3): places the active `placeKind` (not
  hardcoded space); renders the highlight ring; does not place when clicking an
  existing point.
- `VenueMapDesigner.test.tsx` (+2): coverage panel + "+ Add pin" updates coverage
  and the spaces count; palette drives the placed kind.
- `venueMapDesigner.test.ts` (+1): removing a point drops a route that falls below
  2 points while keeping one that still qualifies.

## Follow-up — printable title/legend + unsaved-changes guard
7. **In-SVG title & color legend.** The exported/printed Venue Map previously had
   no title or key. `VenueMapCanvas` now draws an optional in-SVG title (top
   center) and a color legend (bottom-right) for the kinds present, so both show
   up on-screen **and** in the PNG/PDF export. The designer passes the venue name
   (`mapTitle`) and enables the legend.
8. **Unsaved-changes guard.** The designer now reports `dirty` state via
   `onDirtyChange` (any canvas placement/drag/edit sets it; any save clears it).
   The module view shows an "● Unsaved" badge and confirms before leaving when
   dirty, so a venue admin can't silently lose in-progress map work.

Tests: `VenueMapCanvas.test.tsx` (+1 legend), `VenueMapDesigner.test.tsx` (+1
dirty-state). CI now **559 passing / 11 skipped**.

## Follow-up — walkway rename + empty-state guidance
9. **Rename walkways.** Each route now has a ✏️ rename action (inline input,
   Enter to save, Escape to cancel, blank keeps the current name) via a pure
   `renameMapRoute` helper (+ test).
10. **Empty-state guidance.** A fresh (no-pin) map now shows a centered hint over
    the canvas — "click the canvas to place a point, or add venue pins from the
    side panel" — so a venue admin knows how to start.
Tests: `VenueMapDesigner.test.tsx` (+2), `venueMapDesigner.test.ts` (+1).
CI now **562 passing / 11 skipped**.

## Follow-up — undo/redo + keyboard Delete
11. **Undo / redo.** The designer now has undo/redo (header buttons + Ctrl/Cmd+Z,
    Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y) across placements, drags (coalesced to one
    step per drag), deletions, route add/delete/rename, and resize — capped at 60
    steps. This addresses the biggest risk of a diagramming tool: accidental
    placement/delete with no way back.
12. **Keyboard Delete/Backspace** removes the selected point.
13. **Scoped the floor-plan keyboard shortcuts to the Studio view.** The global
    keydown handler in `AuthenticatedApp` used to run in every view and act on a
    (possibly stale) floor-plan selection; it's now gated to `view === 'studio'`,
    which both fixes that latent bug and lets the map module handle Delete safely.
Tests: `VenueMapDesigner.test.tsx` (+2). CI now **564 passing / 11 skipped**.

## Follow-up — field-edit undo, couple/guest preview, duplicate point
14. **Undo covers field-by-field edits.** Label/kind/GPS/X/Y/venue keystrokes were
    previously not in the undo stack. Each selected-point "edit session" now
    captures a single undo snapshot on the first field change, so one Ctrl/Cmd+Z
    reverts the whole session (cleared on reselect/save). `venueMapDesigner` pure
    helpers unchanged.
15. **"Preview as couple/guest" toggle.** A "👁 Preview" header button swaps the
    editable designer for a read-only, full-width `VenueMapCanvas` (title + legend,
    tap-a-GPS-pin opens Google Maps) — exactly what couples & guests see — with a
    banner and a "Back to editing" action. Editing chrome (palette, route builder,
    side panel) is hidden while previewing.
16. **Duplicate-point action.** A "⧉ Copy" button on the selected point's panel
    (plus a pure `duplicateMapPoint` helper) clones the point at a small clamped
    offset, labels it "(copy)", and selects the copy. Does not join existing
    walkways; undoable.
Tests: `venueMapDesigner.test.ts` (+2 duplicate), `VenueMapDesigner.test.tsx`
(+3). CI now **569 passing / 11 skipped**.

## Files
- `src/components/VenueMapCanvas.tsx`
- `src/components/VenueMapDesigner.tsx`
- `src/utils/venueMapDesigner.ts`
- `src/components/VenueMapCanvas.test.tsx` (new)
- `src/components/VenueMapDesigner.test.tsx`
- `src/utils/venueMapDesigner.test.ts`
