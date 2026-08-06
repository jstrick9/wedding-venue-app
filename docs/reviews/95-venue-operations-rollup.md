# Review 95 — Venue operations rollup & itinerary polish (round 17)

Continuing the venue-side visibility and operational depth of the couple
package/guest-event system.

## 1. Aggregate operational summary (venue Couples & Events)
A summary strip at the top shows, across all active couples:
- active couple count,
- layouts awaiting review,
- setup completion % (done/total setup tasks),
- total overnight guests (red when over total overnight capacity).

## 2. Venue guest viewer shows each guest's invited events
The per-couple guest viewer lists the events each guest is invited to under their
name (rehearsal dinner, ceremony, overnight lodging, etc.).

## 3. Venue sees derived guest events before the couple logs in
The venue's Itinerary expandable ensures derived guest events exist (from the
assigned package + the couple's add-ons) before listing them.

## 4. Guests assigned to overnight-lodging see the Lodging tab
A guest invited to the couple's "Overnight Lodging" guest event gets access to the
Lodging tab in their portal even without an explicit allowLodgingAccess flag.

## 5. Couple Overview progress step
Added "Guest itinerary set up" to the couple's progress checklist (guest events
exist and guests have been assigned).

## 6. Manual RSVP includes assigned events
Recording a guest's RSVP by hand now defaults attendingEvents to the guest's
assigned guest events so per-event counts stay accurate.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green. Full suite: **428 passing / 11 skipped**. Unused-locals scan clean.
