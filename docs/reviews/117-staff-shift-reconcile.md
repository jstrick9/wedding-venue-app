# Review 117 — Staff-shift data-integrity fixes

Found and fixed two related bugs in the venue's calendar → staff-shift linking.

## 1. Deleting a calendar event left orphaned staff shifts
`removeVenueCalendarEvent` only removed the event itself; linked `StaffShift` rows
(created by `syncShiftsForCalendarEvent`) were left orphaned in storage. It now
cascade-deletes shifts via `removeShiftsForCalendarEvent`. Committed `a922b20`.

## 2. `syncShiftsForCalendarEvent` only added, never removed/updated
The shift sync was additive-only: it created shifts for new assignees but (a) never
removed shifts for assignees dropped from the event, and (b) never refreshed the
time/role/name/notes on existing shifts when the event was rescheduled. Rewrote it
to fully reconcile:
- removes shifts for assignees no longer assigned (or when assignees is empty),
- refreshes start/end time, role, event name, and notes on existing shifts,
- adds shifts for new assignees.
Also fixed the VenueCalendar save handler so it calls the sync even when an event
ends up with **zero** assignees (previously the `assignees.length > 0` guard meant
unassigning everyone left stale shifts). Committed `e734a2f`.

## Tests
- `venueCalendarService.test.ts` — cascade-delete shifts on event removal.
- `venueShiftService.test.ts` — removes dropped-assignee shifts; updates an existing
  shift when the event time changes.

Full suite: **482 passing / 11 skipped / 124 files**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build` all green.
