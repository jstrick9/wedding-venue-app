# Review 115 — Safe date formatting, guest-event day/time editing, capacity warnings

Another autonomous gap-hunt round on the couple/guest experience, all CI-validated.

## 1. Safe date/time formatting (crash guard)
The couple portal called `new Date(item.startTime).toLocaleString()` and
`new Date(ge.startTime).toLocaleTimeString()` unguarded; a malformed/incomplete
date string (e.g. bad data in a schedule item or guest event) would throw
"Invalid time value" and blank the page. Added `safeTime`/`safeDateTime` helpers
that fall back to the raw string. Committed `34d8b80`.

## 2. Edit a guest event's day & start time (was capacity-only)
Guest events carry a `dayIndex` + `startTime` (shown to guests as their itinerary),
but the couple could only edit **capacity**. Added a datetime-local time picker and,
for multi-day events, a day selector so the couple can schedule each guest event.
Committed `2c7749a`.

## 3. Venue couple creation form — package capacity warning
The venue creation form now warns when the entered guest count exceeds the chosen
package's `maxGuests`. Committed `167d4d1`.

## 4. RSVP per-event over-capacity flag
The couple's "RSVPs per event" summary now highlights (red + ⚠️) any event whose
**attending** count exceeds its capacity, so the couple spots a crowded event.
Committed `e5a4e27`.

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**479 passing / 11 skipped / 124 files**), `npm run build` all green.
