# Review 63 — Persist lightweight UI preferences across sessions

Sidebar width/collapsed state and the grid/snap settings all reset to defaults on every
page load, so a returning user's workspace arrangement was forgotten.

**Fix:** `AuthenticatedApp` now reads/writes a `spm_ui_prefs` blob (new
`STORAGE_KEYS.UI_PREFS`) holding sidebar width/collapsed plus grid show/size/contrast and
snap-to-grid. Values are restored on mount (guarding each field's type) and saved
whenever they change. Storage is wrapped in try/catch so corrupt/quota-blocked storage
never breaks the app.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 325 passed / 11 skipped (storage-keys uniqueness test still passes).
