# Review 89 — Continued gap pass round 11

Autonomous bug-hunt and UI/UX improvement pass. Two features/fixes committed,
each CI-validated.

## 1. Couples can manually record a guest's RSVP
Guests RSVP online, but some respond by phone/email. Added a "📝 Record RSVP"
action per guest in the Couples Portal that lets the couple set attending status,
meal choice (from their configured options), plus-one, and notes — via a new
`upsertCoupleRsvp` service (idempotent per guest/couple) + unit tests.

## 2. Wayfinding walkway route requires at least 2 points
A route could be saved with 0 or 1 points, which rendered as nothing in the guest
map. Now the venue gets a clear message and must add at least 2 points to a path.

## CI
All commits green: `npm run typecheck`, `npm run lint:events`, `npx vitest run`,
`npm run build`. Full suite: **396 passing / 11 skipped**.
