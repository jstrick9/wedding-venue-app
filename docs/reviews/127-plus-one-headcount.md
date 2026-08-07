# Review 127 — Include plus-ones in attending & catering counts

## What
The couple's RSVP summary and the venue's catering summary **under-counted** guests:
- The "Attending" KPI counted only guests, not their plus-ones.
- The meal-summary "attending" total and the venue's per-meal catering summary
  counted a plus-one's *meal choice* but dropped a plus-one with **no** meal choice
  (missing from the catering total entirely).

## Change
- **Couples portal**: "Attending" KPI now = attending guests + their plus-ones;
  the meal summary counts each plus-one as a head (with its meal or as "No meal
  selected") and reports "N attending (incl. plus-ones)".
- **Venue couples admin**: the per-meal catering summary now also counts plus-ones
  without a meal under "No meal selected".

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**482 passing / 11 skipped / 124 files**), `npm run build` all green.
