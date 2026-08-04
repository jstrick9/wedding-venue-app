# Review 75 — Warn before switching venues with unsaved layout work

Switching venues loads that venue's master layout, which **silently replaced** the
current layout — so a planner who had placed tables/fixtures/decor on the current venue
lost that work the moment they picked a different venue in the header dropdown.

**Fix:** `handleVenueChange` now detects unsaved placed work on the current venue. When
present (and the target differs from the current venue), it shows a ConfirmDialog
("Discard & Switch") instead of silently switching. Confirming discards the work and
loads the new venue's master layout; cancelling stays put. This mirrors the existing
template-overwrite guard.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 329 passed / 11 skipped.
