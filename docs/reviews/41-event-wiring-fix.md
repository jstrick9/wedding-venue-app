# Re-Review — Event-bus → modal wiring fix + guard

## Critical finding (regression I introduced)
Removing `useAppModals` earlier dropped the listeners for `spm_open_vendors`,
`spm_open_timeline`, and `spm_open_decor_designer`. These events are emitted by
the Header ("Vendors", "Timeline") and Sidebar/PropertiesPanel ("Decor
Designer"), so those buttons silently did nothing.

## Fix
Re-added the listeners in `AuthenticatedApp`:
- `spm_open_vendors` → `open('vendors')`
- `spm_open_timeline` → `open('timeline')`
- `spm_open_decor_designer` → `open('decorDesigner')` (+ optional arrangement id)

## Guard (prevents recurrence)
Added `utils/eventListenerParity.test.ts`: statically scans the codebase for
every `emit('spm_open_*')` and asserts each has a matching `on('spm_open_*')`
listener. A dead emitted event now fails CI instead of silently shipping a dead
button.

## Note
An initial attempt at an App-mount integration test for these was flaky under
jsdom (lazy-chunk resolution), so it was removed in favor of the reliable
static parity test + the existing `appEvents.test.ts` (delivery) + isolated
component render tests.

## Validation
- Typecheck clean; full suite **301 / 11 skipped**; build succeeds.
