# Review 91 — Venue-configurable wedding packages & add-ons

Built a venue-configurable package + add-on system supporting a full-service
venue's tiers (single-day / multi-day / full weekend), season pricing, lodging,
and add-ons. Reviewed www.sevenpathsmanor.com to ground the model in real
offerings (8 ceremony areas, tables/chairs, Something Borrowed decor collection,
dance floor, lodging properties, horse & carriage, activities, photography, city
experiences, etc.).

## 1. WeddingPackage (venue-configurable)
- name, description, duration type (single-day / multi-day / full-weekend)
- season pricing: non-peak / peak / premier
- included guest count + overnight-guest count
- `lodgingIncluded` + selectable lodging properties (venue ids)
- included-items checklist (from an `INCLUDED_ITEMS` catalog of a full-service
  venue's rental inclusions)
- active toggle
- `seedDefaultWeddingPackages()` seeds SPM-informed tiers (Friday/Saturday
  single-day, 2-day no-overnight, 2-day with 25 overnight, full weekend with 40).

## 2. PackageAddOn (venue-configurable add-ons)
- name, category (lodging/activity/service/ceremony-reception/animal/
  photography/city/guest/time/other), price, pricing note, description
- `seedDefaultPackageAddOns()` seeds common add-ons (horse & carriage, guided
  activities, decorating services, day-of coordination, additional guests,
  extra time, city rehearsal dinners, etc.)

## 3. Couple booking + add-ons
- `CoupleEvent` gains `packageId` + `addOns`.
- Venue assigns a package when creating/editing a couple event; the assigned
  package is shown on the couple card, and assigning **auto-suggests the venue's
  setup/staffing tasks** (marked `suggested`) from the package's included items.
- The couple's **Package** tab shows their booked package (duration, season
  pricing, guest/overnight limits, lodging-included, included items) and lets
  them add/remove paid add-ons after booking.

## Data & integration
- Services: `couplePackageService.ts`, `coupleAddOnService.ts` (+ tests),
  `coupleSetupService.ts` now accepts `suggested`.
- Storage keys/versions + backup domains for both new domains.

## Tests
Unit tests for both services. Full suite: **420 passing / 11 skipped**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green before each commit.
