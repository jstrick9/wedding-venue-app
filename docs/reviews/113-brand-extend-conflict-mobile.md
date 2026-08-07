# Review 113 — Brand consistency completion, calendar conflict edge, couple warnings, mobile drawer

Another autonomous gap-hunt round, CI-validated and committed.

## 1. Brand purple everywhere (remove leftover indigo)
Extended the venue brand accent `#4A1942` to the remaining **active** venue-facing
surfaces that still used Tailwind `indigo`: VendorPanel, CoupleManagement,
PackageManagement, VenueCalendar, VenueDashboard, admin sub-editors (Table, Fixture,
Venue, Template, Structures, Event Questions), AuthenticatedApp, LoginScreen,
LodgingBuilder, and CoupleLayoutEditor. Now the only remaining indigo is in two
**dead** components (GuestPortalManagement, GuestPanel) that were removed from the
venue portal. Committed `e756d6c`.

## 2. Calendar conflict detection now covers multi-day couple events
`findBlockedBookedConflicts` only inspected each item's primary `date`. A blocked
date on a **secondary day** of a multi-day couple event (e.g. rehearsal-dinner day)
wasn't flagged. The util now honors `extraDates`. Committed `d1f8a4e`.

## 3. Couple portal: warn on submitting with no drawn layout
The submit button only required ≥1 selected space, so a couple could submit with
zero actual drawings. It now warns if no selected space has a drawn layout
(tables/fixtures/decor), nudging them to use the layout editor. Committed `dc4596e`.

## 4. Venue couples admin: flag over-capacity guest count
The couple list now shows a red ⚠️ when a couple's invited guest count exceeds their
package's `maxGuests`, so the venue catches an overbooked event early. Committed
`1f2d631`.

## 5. Venue dashboard: mobile-responsive sidebar
The fixed `w-60` sidebar now becomes an off-canvas drawer on small screens with a
hamburger toggle, a backdrop overlay, and auto-close on navigation; it stays static
on `lg+`. Committed `3bc4d38`.

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**479 passing / 11 skipped / 123 files**), `npm run build` all green.
