# Module Review 03 — Event Bus & App Shell

**Scope:** `src/utils/appEvents.ts`, `src/App.tsx`, `src/components/Toast.tsx`, `src/components/LiveRegion.tsx`, `src/components/AppStatusBar.tsx`, `src/components/AppErrorBoundary.tsx`, `src/contexts/ModalContext.tsx`, `src/hooks/useAppModals.ts`, `scripts/check-event-bus.mjs`.

## Summary

The typed event bus is the strongest part of this app's architecture: every `spm_*` event is declared in a compiler-checked map, emitters/subscribers go through `emit`/`on`, and a lint script forbids raw `window.dispatchEvent`. Modal state is centralized in `ModalContext` with clean subscribers in `useAppModals`. The shell components are solid. Two cross-cutting gaps were found.

## Findings

### P2 — Storage errors were only surfaced inside the authenticated workspace
`ToastContainer` and the `spm_storage_error` → toast listener both lived in `AuthenticatedApp`. But localStorage is also read on the **login screen** and **guest portal** (via `loadVersionedStorage`/`loadFromStorage`), so a corrupt storage key on those screens emitted an event that nobody rendered. The error was silently dropped right when the user most needed a hint.
**Fix:** Moved `ToastContainer` to the **App root** and added a `GlobalStorageErrorListener` that subscribes to `spm_storage_error` and shows a toast regardless of which screen is mounted. Removed the now-duplicate listener/container from `AuthenticatedApp`. Added a regression test proving a storage error surfaces as a toast while the login screen is shown.

### P3 — Error-boundary "Reset Local App Data" wiped everything with no recovery path
`AppErrorBoundary.handleResetLocalData` removed every `spm_*`/`wedding-layout-*` key. If a user clicked it by accident (or it ran while storage was healthy), all planning data was destroyed with no way back.
**Fix:** The boundary now snapshots all app keys into `spm_backup_emergency_reset` before wiping, so a mistaken reset isn't fatal.

## Verified healthy (no change needed)
- Typed event bus with compile-time payload checking + lint enforcement.
- `useAppModals` correctly owns `spm_open_*` subscriptions (no dead event handlers; every declared event has a subscriber — verified by grep).
- `ModalContext` open/close/toggle with arrangement-id reset.
- Toast dedupe (1.2s) and `announce()` for screen readers.

## Cross-module dependencies affected
- **All screens** now surface storage errors (login, guest portal, workspace).
- **AuthenticatedApp** no longer renders its own toast container (App root owns it).
- **AppErrorBoundary** — pre-wipe backup; no behavior change to normal error rendering.

## Validation
- Typecheck clean.
- Added `src/App.storageError.test.tsx`.
- Full suite: **242 passed / 11 skipped** (was 241).
- Production build succeeds.
