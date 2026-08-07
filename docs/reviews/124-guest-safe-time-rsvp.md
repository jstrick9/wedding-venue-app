# Review 124 — Guest portal: safe time in event-scoped RSVP checkboxes

## What
The guest RSVP form's event-scoped "Which events will you attend?" checkboxes
formatted each event's start time with an unguarded
`new Date(e.startTime).toLocaleTimeString()`, which could throw "Invalid time value"
on malformed data.

## Change
Switched to the existing `safeTime` formatter (falls back to the raw string).

## Verified as non-issues
- Recurring blocked-vs-booked calendar conflicts are already surfaced via the
  conflict banner.
- A guest who already RSVP'd can still edit their response after the deadline
  (reasonable UX); only brand-new RSVPs are blocked when closed.
- Venue vendor/category removal degrades gracefully (couple vendors keep a snapshot;
  orphaned category ids fall back to their raw label).

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**482 passing / 11 skipped / 124 files**), `npm run build` all green.
