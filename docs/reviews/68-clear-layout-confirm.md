# Review 68 — On-brand confirm for "Clear All Items"

The Sidebar's destructive "Clear All Items" action used the native browser `confirm()`
(via `useLayoutState.clearLayout`), the last remaining native confirm in the main
workspace flow.

**Fix:** the Sidebar button now opens the reusable, accessible `ConfirmDialog`
(focus-trapped, Escape-to-cancel, danger tone, "Clear All" label) before calling
`onClearLayout`, matching the polished confirm experience used elsewhere in the app.

## Validation
- `npm run typecheck` clean; build green (~1.34 MB / ~305 KB gzip).
- `npx vitest run`: 325 passed / 11 skipped.
