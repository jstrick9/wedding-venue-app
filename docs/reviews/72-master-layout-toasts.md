# Review 72 — Master-layout save/clear feedback

Saving or clearing a venue's **master layout** (used as the starting point for basic
users) gave no confirmation, so an admin couldn't tell whether the action succeeded.

**Fix:** wrapped `saveMasterLayout` and `clearMasterLayout` in `AuthenticatedApp` with
success toasts ("Saved as the master layout for <venue>" / "Master layout cleared."),
matching the feedback added for layout save/delete/export in earlier rounds.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 328 passed / 11 skipped.
