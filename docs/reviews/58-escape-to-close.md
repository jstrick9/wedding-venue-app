# Review 58 — Escape closes panel modals (with ConfirmDialog coordination)

Panel modals (vendors, timeline, guests, admin, templates, print, operations,
messages, submission, event questions, decor designer, overview) could only be closed
by clicking a button — pressing Escape did nothing, which contradicts a basic modal
UX expectation.

**Fix:** the `ModalProvider` now listens for `Escape` and closes the open panel
modal(s). To avoid closing a panel underneath a confirm, `ConfirmDialog` reports its
open state via a small shared module (`utils/modalEscape.ts`); the global handler
defers whenever a confirm is on top (so Escape cancels the confirm without also
closing the panel). Adds ModalContext.test.tsx covering both behaviors.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 325 passed / 11 skipped (was 323; +2).
