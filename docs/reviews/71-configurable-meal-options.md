# Review 71 — Configurable guest RSVP meal options

The guest RSVP meal-choice dropdown was hardcoded, so a venue couldn't tailor it to
their catering menu.

**Fix:** meal options are now configurable end to end:
- Added `GuestPortalConfig.mealOptions?: PortalMealOption[]` (a `{ value, label }`
  pair) plus a shared `DEFAULT_MEAL_OPTIONS` (Standard, Chicken, Beef, Fish,
  Vegetarian, Vegan, Gluten-free, Kids, Other).
- **GuestPortal admin:** a new "Meal Choices" editor in the Guest Portal
  Configuration section — add an option (press Enter or click Add), remove options as
  chips, and the list persists with the rest of the portal config.
- **Guest RSVP:** both the guest and plus-one meal selects render the configured options
  (falling back to the defaults when none are set). Stored `value`s are stable, so
  previously-submitted RSVPs remain valid.
- The portal config backup domain writes the whole config object, so `mealOptions`
  round-trips through backup/restore automatically.

Adds GuestPortal.mealOptions.test.tsx (defaults rendered when unconfigured; venue
options rendered instead of defaults).

## 2. Table type search (TableManagement)
Completing catalog-search coverage across the admin: Table Types now has a live
"Search table types…" box that filters the list by name, matching the search added to
Venues, Fixtures, and Users in earlier rounds.

## 3. Permission search (Access Control)
The role editor's matrix view lists all 51 permissions in one table with no way to find
one. Added a "Search permissions by name or id…" box that filters the matrix table live.

## Validation
- `npm run typecheck` clean; build green (~1.34 MB / ~306 KB gzip).
- `npx vitest run`: 328 passed / 11 skipped.
