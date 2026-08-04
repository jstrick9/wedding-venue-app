# Re-Review — Browser tab title (polish improvement)

## Finding
`document.title` was never updated — the browser tab always showed the default
"Seven Paths Manor | Wedding Layout Planner", even when branding was customized
or a specific event was opened. The Guest Portal tab also showed the generic
title regardless of event.

## Improvement
- `AuthenticatedApp`: sets the tab title to the configured `venueName` (updates
  when branding changes).
- `GuestPortal`: sets the tab title to the event title (or a generic fallback).

## Validation
- Typecheck clean; full suite **302 / 11 skipped**; build succeeds.
