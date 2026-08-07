# Review 116 — Calendar event detail, guest-event location

Another autonomous gap-hunt round, CI-validated.

## 1. Venue calendar event detail — show the full picture
The calendar's event-detail popover only showed title/date/start-time/staff. The
venue had stored **end time, venue space, notes, and recurrence**, but none were
displayed. The detail now shows end time, the linked venue space name, notes, and a
"↻ Repeats …" line. Committed `055814e`.

## 2. Guest events — let couples set a location
Guest events carry a `location` (shown in the guest's itinerary), but the couple
couldn't set one. Added a location field to the guest-event edit controls and the
"add custom guest event" form, and surfaced location in the venue's guest-event
view for planning. Committed `32ebe76`.

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**479 passing / 11 skipped / 124 files**), `npm run build` all green.
