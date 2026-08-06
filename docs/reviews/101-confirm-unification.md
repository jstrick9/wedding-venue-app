# Review 101 — B5: unify confirmation dialogs via `useConfirm`

## What
Eliminated the last native `window.confirm` dialogs in favor of the shared,
accessible in-app `ConfirmDialog` via a new promise-based `useConfirm()` hook.

## The hook (`src/components/useConfirm.tsx`)
```ts
const { confirm, confirmDialog } = useConfirm();
const ok = await confirm({ title, message, confirmLabel, cancelLabel, tone });
// ...and render {confirmDialog} once in your JSX.
```
`confirm(...)` returns a `Promise<boolean>` that resolves `true` on confirm and
`false` on cancel. The rendered dialog is the single shared `ConfirmDialog` (focus
trap, auto-focus confirm button, Escape to cancel, click-outside to cancel).

## Migrated components (all native `window.confirm` removed)
- **PackageManagement** — delete package / delete add-on.
- **VenueWayfindingManagement** — reset entire venue map.
- **CoupleManagement** — delete couple event.
- **CustomVenueBuilder** — unsaved-shape-changes close guard (now async; Escape
  handler uses `void requestClose()`).

Toast was already centralized via `showToast`; modals via `ModalDialog` /
`CenteredModal`; reduced-motion is already handled by a global
`prefers-reduced-motion` media query in `index.css`.

## Tests
`useConfirm.test.tsx` — confirms dialog opens, resolves `true` on confirm and
closes, resolves `false` on cancel. Full suite: **463 passing / 11 skipped / 121 files**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`,
and the unused-locals scan all green.
