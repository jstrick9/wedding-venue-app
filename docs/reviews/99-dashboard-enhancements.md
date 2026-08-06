# Review 99 — Dashboard enhancements: inline panels, drag-reschedule, staffing, onboarding (round 21)

Four follow-up enhancements to the venue dashboard, each CI-validated.

## 1. Inline Admin & Operations inside the dashboard
`AdminPanel` and `StaffOperationsPanel` gained an `inline` prop that swaps their
fixed full-screen overlay root for a normal container. The dashboard's Admin and
Operations sidebar items now render these panels inline in the content area
(AuthenticatedApp passes pre-rendered, permission-gated inline nodes). Users no
longer leave the dashboard to manage venue setup or operations.

## 2. Drag-and-drop rescheduling on the calendar
Venue-created calendar events can be dragged between days in the month and week
views (`moveVenueCalendarEvent`), with grab cursor, opacity on drag, a highlighted
drop target, and a success toast. Couple events stay non-draggable (their date is
owned by the couple event).

## 3. Staffing/assignment view from calendar events
Calendar events gained an `assignees` field. The event form includes an
"Assign staff" selector (from the users list); assigned staff show as a count chip
in the day view and as name chips in the event detail — so the venue can use
calendar events as a staffing/work-activity view (open houses, setup days).

## 4. First-time venue onboarding empty states
When the venue has no spaces or couple events, the Dashboard shows an onboarding
banner with one-click cards: add venue spaces, review packages/add-ons, create the
first couple event, and schedule an open house. The upcoming-events widget gets an
empty-state with a "Schedule an event" action.

## Follow-up (round 22): inline Vendors/Timeline/Guests, shift linking, recurring events
- **Inline Vendors, Timeline & Guests** — those panels also gained `inline` props and now
  render inside the dashboard content area, so all venue management stays in the dashboard.
- **Staff-shift linking** — `StaffShift.calendarEventId` + `venueShiftService` syncs one
  shift per assigned staff member from a calendar event's date/time/role; re-syncs on
  drag-reschedule; event detail shows linked shifts (times + roles).
- **Recurring events** — `VenueCalendarEvent.recurrence` (weekly/monthly/yearly);
  `recurringDatesForEvent` expands occurrences across a range; form "Repeats" selector,
  ↻ badge, and dragging a recurring event turns that occurrence into a one-off.

## Tests
Calendar `moveVenueCalendarEvent`, `recurringDatesForEvent`, VenueDashboard onboarding,
and `venueShiftService` unit tests. Full suite: **453 passing / 11 skipped**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green. Unused-locals scan clean.
