# Review 64 — Helpful "no saved layouts" empty state

The Load Layout modal showed only a terse "No saved layouts found." line. A new user
might not know how to create one.

**Fix:** improved the empty state with an icon and a hint pointing to the header's
"💾 Save Layout" action so users know exactly how to get a layout to appear here.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 325 passed / 11 skipped.
