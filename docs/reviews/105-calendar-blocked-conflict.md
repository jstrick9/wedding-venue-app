# Review 105 — Calendar: blocked-vs-booked conflict warning

## What
Fixed a data-integrity/UX gap: the venue could mark a date "Blocked / Unavailable"
that is also holding a confirmed couple event — a contradiction with no signal.

## Change
`VenueCalendar` now computes any date that is both `blocked` and `couple` and shows
a prominent amber `role="alert"` banner listing the affected dates with a suggested
remedy (remove the blocked entry if the couple is confirmed).

The logic is a pure, tested helper:

```
src/utils/calendarConflicts.ts
  findBlockedBookedConflicts(items: { date; category }[]): string[]  // sorted dates
```

## Tests
`calendarConflicts.test.ts` — 4 cases: both-blocked-and-booked, no conflicts,
chronological sorting, and date-less items ignored.
Full suite: **467 passing / 11 skipped / 122 files**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build` all green.
