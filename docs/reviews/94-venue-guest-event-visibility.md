# Review 94 — Venue visibility of couple guest events & overnight counts (round 16)

Natural follow-up to the per-couple guest-event/itinerary work: give the venue
visibility into each couple's guest events and overnight-lodging situation.

## 1. Venue sees couple guest-event itinerary
The venue Couples & Events card gains a "🗓️ Itinerary" expandable showing each
guest event (rehearsal dinner, ceremony, cocktail hour, reception, overnight
lodging, activities) with:
- invited / attending counts vs capacity,
- the day/time the event falls on,
- the list of invited guests (truncated with full list on hover).

## 2. Overnight-guest count on the couple card
The couple card shows a "🛏️ assigned/capacity overnight" badge derived from the
lodging guest event vs the package's overnight capacity (red when over). This lets
the venue:
- plan overnight prep at a glance,
- see when lodging add-ons push overnight guests over the package limit.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green. Full suite: **428 passing / 11 skipped**.
