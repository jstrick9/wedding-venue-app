# Review 110 — Autonomous gap-hunt: capacity verification, RSVP deadline, calendar

A focused pass on the guest-count ↔ seating-capacity theme and two smaller fixes,
each CI-validated and committed.

## 1. Couple layout editor — seating capacity vs guest count
`CoupleLayoutEditor` now accepts a `guestCount` prop (fed from the couple event's
guest count or the booked package's max guests) and computes the total seating
capacity of placed tables (honoring per-table `customCapacity`). The header shows
"🪑 Seats X / Y guests", turning amber with ⚠️ when the layout under-seats the
expected guests — so the couple catches an undersized plan before submitting.

## 2. Venue approval queue — same per-space check
`CoupleLayoutPreview` now also computes and shows per-space seating capacity vs
the event's guest count, so the venue can verify each drawn layout seats everyone
while approving. (Both the couple's editor and the venue's preview share the same
seating-capacity math.)

## 3. Guest RSVP deadline — off-by-one (timezone) bug fix
`new Date("2026-09-01")` is midnight UTC, so a date-only deadline from the couple's
portal-settings date input closed RSVPs a day early in US timezones. The guest
portal now treats a `YYYY-MM-DD` value as the full local day (closes at
23:59:59.999 local), while still honoring explicit date-time values.

## 4. Venue calendar — couple guest counts + multi-day display
Couple entries now render "Couple Name (guestCount)", and a multi-day couple event
(e.g. rehearsal dinner + ceremony) is surfaced on **every** booked day instead of
only its first day.

## 5. Guest RSVP a11y
Attending Yes/No buttons carry `aria-pressed` so screen-reader/keyboard users get
their selected state.

## Tests
- `CoupleLayoutEditor.test.tsx` — +2 capacity cases (shortfall warns, meets does not).
- `CoupleLayoutPreview.test.tsx` — new file, 3 cases.

Full suite: **473 passing / 11 skipped / 123 files**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`,
unused-locals scan all green. Committed across 5 pushes to `main`.
