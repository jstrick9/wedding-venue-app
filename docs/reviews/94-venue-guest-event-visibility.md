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

## 3. Guests assigned to overnight-lodging see the Lodging tab
A guest invited to the couple's "Overnight Lodging" guest event gets access to the
Lodging tab in their portal, even without an explicit allowLodgingAccess flag —
the itinerary assignment drives what lodging info they see.

## 4. Venue sees derived events before the couple logs in
The venue's Itinerary expandable ensures derived guest events exist (from the
assigned package + the couple's add-ons) before listing them, so the venue can
view guest events and counts even if the couple hasn't opened their portal.

## 5. Venue guest viewer shows each guest's invited events
The venue's per-couple guest viewer lists the events each guest is invited to
under their name, so the venue sees the per-guest itinerary at a glance.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green. Full suite: **428 passing / 11 skipped**.
