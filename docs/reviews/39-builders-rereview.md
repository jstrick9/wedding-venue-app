# Re-Review — CustomVenueBuilder + LodgingBuilder

Deep review of the two venue builders (requested: make them work flawlessly with
the best UI/UX).

## CustomVenueBuilder (was wired + functional) — robustness/UX improvements
- **Shape validation on save**: prevents saving degenerate shapes (fewer than 3
  distinct points, or zero/near-zero area via the shoelace formula). Uses a toast
  (not a blocking alert).
- **Unsaved-changes guard**: tracks dirty state; Close (and Escape) now prompt to
  discard before closing. Saving marks the shape clean.
- **Escape-to-close** added with the same guard.
- Verified the save path is consistent with the canvas (shapePoints are in feet
  relative to the venue origin; canvas offsets by venueX/venueY — no unit bug).

## LodgingBuilder (was COMPLETELY UNRENDERED / dead code) — wired in
- **The feature was dead**: `LodgingBuilder` (a complete floors/rooms/furniture/
  guest-assignment editor) was never imported or rendered anywhere.
- **Fixed guest source**: it read a legacy `wedding-layout-guest-list`
  localStorage key the app no longer writes; now derives guests from the real
  saved-layouts guest list (via `getSavedLayouts`).
- **Wired into the UI**: added a **🏨 Lodging** button in the Venue admin editor
  (next to Shape Builder) that opens the builder; saving persists `floors` to the
  venue via `handleSaveVenues`. Added `setLodgingVenueId` to the shared admin
  props.

## Cross-module impact
- VenueManagement now exposes both the Shape Builder and the Lodging builder.
- Lodging floors saved in the builder are rendered by the Guest Portal's lodging
  tab (which already reads `venue.floors`).

## Validation
- Typecheck clean; admin tests pass; full suite **307 / 11 skipped**; build
  succeeds.
