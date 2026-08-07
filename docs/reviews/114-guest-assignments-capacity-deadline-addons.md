# Review 114 — Guest seat/room assignment, capacity guards, deadline display, add-ons total

Another autonomous gap-hunt round focused on the couple/guest experience, all
CI-validated and committed.

## 1. Guest table/seat & room assignment (was shown but not editable)
The guest portal displays "Your seat is at Table X" and "Your room: Y", but neither
the couple portal nor the venue had any way to set those fields — a dead-end for the
couple planning seating/lodging. Added **Table / seat** and **Room** fields to the
couple's guest **Edit** form (and show them on the couple's guest list and the
venue's per-couple guest view so the venue can plan seating/lodging too). Committed
`4e198f7`.

## 2. Guard guest-event capacity from NaN/0
Clearing a guest event's capacity (or typing a non-numeric value) produced `0` /
`NaN`, which broke the "at capacity" logic (everything appears full). The capacity
editor now ignores invalid/empty input and the "add custom event" handler falls back
to 25. Committed `142c6c9`.

## 3. RSVP deadline message off-by-one
The "The RSVP deadline was …" message formatted `new Date("2026-09-01")` (UTC
midnight), which could show the **previous** day in US timezones. It now displays
the intended local day. Committed `0e18655`.

## 4. Add-ons count + total price
The couple's Package tab now shows a running total of selected add-ons (count and
sum) so they can see the cost impact of their choices. Committed `7d51655`.

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**479 passing / 11 skipped / 123 files**), `npm run build` all green.
