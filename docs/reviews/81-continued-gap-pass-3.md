# Review 81 — Continued gap pass round 3

Autonomous bug-hunt and UI/UX improvement pass. Seven findings fixed, each
CI-validated and committed to `main`.

## 1. Couple RSVP summary counts could go negative / miscount
The "No response" count was `guestCount - rsvps.length`, which could go negative
and miscount when stale RSVPs from removed guests remained. Now the attending /
not-attending / no-response cards count actual guests in the current list, so
they always sum to the invited total and never go negative.

## 2. Guest portal "Contact the Venue" card omitted the email
The card only showed phone and location, ignoring the venue's configured support
email. Added a mailto link when a support email is set.

## 3. Guest RSVP reminders for the couple
Guests who hadn't responded were only a "No response" count with no follow-up
path. Added a per-guest 🔔 Remind button (pre-filled reminder mailto with the
guest's invite link) and a "📄 No-response list (N)" CSV export, both gated to
couple/planner.

## 4. Venue weather auto-fetch failed silently
The auto-fetch button gave no feedback when a location wasn't found or the API
errored. Added clear success / warning toasts for found, empty, and failed
cases, plus a guard for a blank location input.

## 5. Guest wayfinding availability check used raw map points
`hasWayfindingPoints` was based on the raw map point count, so a map with only
decorative path dots (or a couple with no scoped spaces) still showed the
wayfinding From/To selects with no destinations. Now keyed off the actual
couple-scoped wayfinding points.

## 6. Preview portal mode (approved via clarifying question)
The couple's "Preview portal" button only opened the sign-in gate. Added a
read-only `?preview=1` mode that bypasses the gate, never creates a guest
session, shows an amber "Preview mode" banner, keeps access-controlled tabs
visible when the venue enabled them, and shows a friendly "RSVP is for invited
guests" notice on the RSVP tab. + 2 tests.

## 7. RSVP special-needs and notes invisible to couple + venue
Guests can submit special-needs (accessibility) and notes on their RSVP, but the
couple's RSVP detail and the venue's guest viewer never showed them. Now:
- couple RSVP detail shows special needs + notes (and the "no details" fallback
  is suppressed when they're present),
- venue guest viewer shows a compact meal/special-needs/dietary summary for
  attending guests (full details on hover).

## CI
All commits green: `npm run typecheck`, `npm run lint:events`, `npx vitest run`,
`npm run build`. Full suite: **390 passing / 11 skipped**.
