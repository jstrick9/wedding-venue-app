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

## CI
557 passing / 11 skipped (was 551). Typecheck, event-bus lint, unused-locals, and
single-file build all green.

## Files
- `src/components/VenueMapCanvas.tsx`
- `src/components/VenueMapDesigner.tsx`
- `src/utils/venueMapDesigner.ts`
- `src/components/VenueMapCanvas.test.tsx` (new)
- `src/components/VenueMapDesigner.test.tsx`
- `src/utils/venueMapDesigner.test.ts`
