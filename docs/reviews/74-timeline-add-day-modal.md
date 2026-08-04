# Review 74 — Replace native prompt() "Add Day" with a form modal

The Timeline "Add Day" button opened **two sequential native `prompt()` dialogs** (date,
then label) — jarring, clunky, and inconsistent with the polished confirm/edit modals
elsewhere.

**Fix:** replaced them with a proper "➕ Add Day" modal (date picker + day-label field,
Save/Cancel). Validation requires both fields; on save it calls `addDay` and closes.
This removes the last native `prompt()`/`alert()` from the app's interactive flows.

Adds a TimelinePanel test covering the add-day modal flow (no native prompt).

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 329 passed / 11 skipped (was 328; +1).
