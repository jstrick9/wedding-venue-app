# Review 123 — Venue dashboard: recurring calendar events

## What
The venue dashboard's **Today** strip and **Upcoming events** pipeline only looked at
each calendar event's seed `date`. Recurring events (weekly/monthly/yearly open
houses, staffing, etc.) — which the venue calendar correctly expands via
`recurringDatesForEvent` — were **missing** from the dashboard on their recurring
occurrences.

## Change (`VenueDashboard.tsx`)
- `upcoming` now expands recurring calendar events across the 60-day window (each
  occurrence gets its own row with a deduplicated key `id-date`).
- The Today strip now includes a recurring event when today is one of its
  occurrences.

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**482 passing / 11 skipped / 124 files**), `npm run build` all green.
