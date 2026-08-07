# 129 — Couple map lodging drill-in (pick a room + assign guests)

## Problem
Clicking a lodging space on the couple's interactive venue map only jumped to the
Guests tab — it didn't let the couple assign guests/rooms in the map context where
they already are.

## Change
- New `LodgingAssignmentsModal` component (fixed overlay, matching the
  CoupleLayoutEditor modal pattern). Clicking a lodging pin on the couple's map
  opens it scoped to that lodging venue.
- The panel lists the venue's configured rooms (floors → rooms plus legacy
  `venue.rooms`), each with occupancy/capacity and a full-room guard; an
  "Assign a guest to a room" control (guest select + room select, or a free-text
  "Other room"); and an unassigned/other-guests list with clear-room actions.
- Assignment writes the guest's `roomId` via `updateCoupleGuest` (the couple-owned
  field the Guests tab already uses), so both surfaces stay consistent. Room
  suggestions come from the venue's lodging layout so the couple picks real rooms.
- CouplesPortal's map `onPointClick` lodging branch now opens the panel instead of
  `setActiveTab('guests')`.

## Tests
- `LodgingAssignmentsModal.test.tsx` (new, 6 tests): header + configured rooms with
  occupancy; assign via onAssign; free-text "other" room; full-room guard;
  remove-from-room via onUnassign; legacy single-floor rooms.

## Files
- `src/components/LodgingAssignmentsModal.tsx` (new)
- `src/components/LodgingAssignmentsModal.test.tsx` (new)
- `src/components/CouplesPortal.tsx`

## CI
551 passing / 11 skipped (was 545). Typecheck, event-bus lint, unused-locals, and
single-file build all green.
