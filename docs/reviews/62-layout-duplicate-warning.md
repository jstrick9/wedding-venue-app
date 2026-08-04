# Review 62 — Warn when saving a layout with a duplicate name

The "Save Layout" modal accepted any name, so a user could unknowingly create multiple
saved layouts with the same name (making it hard to tell them apart later).

**Fix:** the save modal now shows an inline amber warning whenever the typed name
matches an existing saved layout (case-insensitive), telling the user a duplicate will
be created. The save still proceeds (the user may intentionally want a named snapshot);
it's a soft confirmation, not a block.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 325 passed / 11 skipped.
