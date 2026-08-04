# Re-Review — Welcome/onboarding (dead feature fix)

## Finding 1 (dead feature)
`showWelcome` was set (for basic/guest users) and `WelcomeModal` imported, but
the modal was **never rendered** — so the first-run onboarding never appeared.
Same class of bug as the earlier dead modal panels.

## Finding 2 (dead state)
`showFloatingViewControls` (useState) was never read or set anywhere — dead
state. The extended parity guard caught it.

## Fix
- Rendered `<WelcomeModal>` when `showWelcome` is true (basic/guest onboarding
  now appears; admins still skip it).
- Removed the dead `showFloatingViewControls` state.

## Guard (extended)
`AuthenticatedApp.modalParity.test.ts` now also asserts every non-modal `showX`
useState flag is referenced in JSX, so a forgotten render (like Welcome) or dead
boolean state fails CI.

## Validation
- Typecheck clean; parity test passes (would have caught both); full suite
  **302 / 11 skipped**; build succeeds.
