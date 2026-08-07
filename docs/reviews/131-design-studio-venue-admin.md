# 131 — Design Studio: venue-admin persona fixes & gaps

As a venue admin, I exercised the Design Studio module (space picker, sidebar
palette, canvas, properties panel, settings, saved/master layouts, templates,
undo/redo, overview) and fixed the gaps/bugs/dead-code found.

## Fixes / improvements

1. **Dead code cleanup — PropertiesPanel.** The venue guest-management removal
   left `guests`, `onAddGuest`, and `onRemoveGuestFromTable` as accepted-but-unused
   props (and an unused `Guest` import). Removed them from the props interface,
   the destructure, the caller (`AuthenticatedApp`), and the test fixture. The
   panel already renders read-only seating capacity with the correct copy pointing
   guests to the couples portal.

2. **Zoom numeric input range inconsistency.** The numeric zoom box rejected
   10–24% and 201–300% even though the slider and ± buttons already reach 10–300%.
   Aligned the validation to 10–300% so the number box matches the other controls.

3. **Couple-capacity verification in the studio.** Guest management lives in the
   couples portal, but the venue admin still needs to confirm a space will seat the
   couple's guests. The canvas capacity indicator now shows, when couples are booked
   into the current space:
   - "Needs seats for N guests" (largest expected guest count across booked couples),
   - a ⚠️ "under-capacity" flag when placed seats < that count,
   - the list of booked couples.
   Pure helper `computeSpaceSeating` (`src/utils/spaceSeating.ts`, +5 tests) keeps the
   logic testable; the existing over-venue-capacity styling is preserved.

## Tests
- `src/utils/spaceSeating.test.ts` (new, 5): no couples, under-capacity, adequate,
  over-venue-capacity, and couples-without-count cases.
- `PropertiesPanel.seating.test.tsx`: updated fixture for removed props.

## CI
574 passing / 11 skipped (was 569). Typecheck, event-bus lint, unused-locals, and
single-file build all green.

## Files
- `src/components/PropertiesPanel.tsx`
- `src/components/AuthenticatedApp.tsx`
- `src/components/Sidebar.tsx`
- `src/components/PropertiesPanel.seating.test.tsx`
- `src/utils/spaceSeating.ts` (new) + `src/utils/spaceSeating.test.ts` (new)
