# Re-Review — Event Questions wizard completion UX (improvement)

## Finding
On the last group, the wizard button still said "Save & Continue" and advanced
past the end with no completion feedback or close.

## Improvement
- On the last group the button now says **"Save & Finish"** and calls an optional
  `onComplete` (wired to close the modal) instead of advancing to a nonexistent
  step.
- Added the `onComplete` prop to the wizard.

## Validation
- Typecheck clean; full suite **302 / 11 skipped**; build succeeds.
