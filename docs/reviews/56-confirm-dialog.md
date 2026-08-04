# Review 56 — Replace native window.confirm() with a polished ConfirmDialog

The app used the native browser `confirm()` in several places, which looks jarring and
out of place in an otherwise custom, on-brand UI (and blocks the tab).

**Fix:** added an accessible, non-blocking `ConfirmDialog` (focus-trapped, Escape to
cancel, confirm-button autofocused, optional `danger` tone) and converted all
destructive/confirm actions to use it:

- VendorPanel — delete vendor
- TimelinePanel — delete timeline
- StaffOperationsPanel — delete task / area / shift, and import-merge confirm
- admin/EventQuestionsManagement — delete question
- LodgingBuilder — delete room
- AuthenticatedApp — template-overwrite guard

The remaining `window.confirm` usages are close/navigation guards (CustomVenueBuilder
"discard changes"), which are intentionally left as-is.

**Tests:** ConfirmDialog.test.tsx (render/confirm/cancel/Escape) and a VendorPanel
delete-through-dialog regression test. Total suite 318 → 323.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 323 passed / 11 skipped.
