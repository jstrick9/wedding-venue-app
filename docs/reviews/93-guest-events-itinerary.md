# Review 93 — Per-couple guest events & per-guest itinerary (round 15)

Based on the user's direction: package/add-on choices that affect guests (limited
rehearsal-dinner attendance, overnight lodging, activities) must be applied to
specific guests and drive each guest's event itinerary rather than treating all
guests as just attending ceremony + reception.

Approved design decisions (via clarifying questions): auto-derive events from
package + add-ons; enforce capacity with a warning; assignment defines the guest's
itinerary (per-event RSVP); manage inside the Guests tab.

## 1. Data model
- `CoupleGuestEvent`: title, kind (rehearsal-dinner/ceremony/cocktail-hour/
  reception/lodging/activity/custom), day, time, location, capacity, derived.
- `guest.guestEventIds[]`: the specific events each guest is invited to.
- `RSVPSubmission.attendingEvents[]`: which events the guest will attend.

## 2. Couple-side management (Guests tab)
- Guest events auto-derive from the couple's package + add-ons (rehearsal dinner
  when applicable, ceremony, cocktail hour, reception, overnight lodging when the
  package has lodging, and each activity add-on). The couple can add custom events
  and edit capacities.
- Each event shows `assigned/capacity` with a red over-capacity warning.
- Per-guest "Invited to events" picker — assigning is blocked at capacity with a
  clear message.
- "RSVPs per event" summary (attending / invited / capacity).

## 3. Guest portal
- Shows the guest's personal "Your invited events" itinerary (only assigned events).
- RSVPs per event ("Which events will you attend?") in a per-couple portal,
  persisted via attendingEvents (falls back to per-day for non-couple portals).

## Data & integration
- Service `coupleGuestEventService.ts` (+ unit tests), storage key/version, backup
  domain, cascade delete on couple delete.

## Tests
Unit tests for the guest-event service + existing GuestPortal/CouplesPortal tests
still green. Full suite: **428 passing / 11 skipped**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green before each commit.
