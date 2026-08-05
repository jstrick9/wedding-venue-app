# Review 78 — Couples-platform bug fixes + guest lodging rooms

Autonomous bug-hunt pass. Found and fixed several real bugs and a UI gap.

## Fixes
1. **Guest copy-link missing `couple` scope (bug):** `buildGuestInviteUrl` omitted the
   `couple` param that email invites included, so a copied guest link opened the wrong
   (venue-wide) portal. Now accepts an optional `coupleEventId` and appends it; the
   couple's Guests tab passes `event.id`. Added a regression assertion.
2. **Answer→space recommendation broken (bug):** `deriveRecommendedVenueCategories`
   matched on questionId text, but question ids are opaque `eq-<timestamp>`, so answers
   never narrowed spaces. Now takes the question list and inspects each question's
   **group**/**text** (mirroring the wizard). Added regression test.
3. **RSVP submissions stored under the wrong key (bug):** a couple-scoped guest RSVP was
   saved with `eventKey = normalizeEventKey(eventTitle)` (e.g. "smith-johnson") but read
   back with `coupleEventId`, so the couple never saw guest RSVPs. Submissions are now
   keyed by `coupleEventId` for couple portals. Added coupleRsvpService tests.
4. **Space narrowing dropped selected spaces (bug):** narrowing `availableSpaces` from
   answers dropped any space the couple had already selected (orphaning it in
   `selectedSpaces`). Selected valid spaces are now preserved in the merged set.

## UI improvement
5. **Guest lodging rooms (gap):** the guest portal lodging tab showed placeholder text;
   it now lists each venue's floors and rooms with capacity/occupancy, highlighting the
   guest's assigned room.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 369 passed / 11 skipped (was 366; +3).
