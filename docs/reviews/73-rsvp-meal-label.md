# Review 73 — Show meal label (not value) in the RSVP confirmation

The guest RSVP confirmation showed the stored meal **value** (e.g. "chicken") instead of
the friendly **label** (e.g. "Chicken"), which looked odd with custom meal options.

**Fix:** the confirmation now maps the stored `mealChoice` through the configured
`mealOptions` (falling back to the raw value if the option was later removed), so guests
see a readable label consistent with the dropdown they chose from.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 328 passed / 11 skipped.
