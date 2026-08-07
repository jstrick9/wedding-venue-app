# Review 122 — Guest portal: add-to-calendar for personal events + safe time

## What
In a per-couple guest portal, the guest's **"Your invited events"** list (their
personal itinerary) showed time/location but:
- formatted the time with an unguarded `new Date(...).toLocaleTimeString()` (could
  throw "Invalid time value" on malformed data), and
- offered no **Add to calendar** action — even though the general schedule does.

## Change
- Personal invited events now use the safe `safeTime` formatter.
- Added an **📅 Add to calendar** button per personal event (reusing the existing
  `.ics` download), shown only when the event has a start time.

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**482 passing / 11 skipped / 124 files**), `npm run build` all green.
