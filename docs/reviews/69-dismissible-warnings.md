# Review 69 — Make the layout-warning banner dismissible

The collision/overlap warning banner (top-center of the canvas) could not be dismissed,
so it stayed on screen until the user fixed the issue — a mild annoyance for a warning
they've already acknowledged.

**Fix:** added a ✕ dismiss button on the banner. Dismissal is keyed to the exact set of
warning ids present at that moment, so the banner stays hidden until the warning set
changes (a new/acknowledged-issue update) and then reappears — keeping the guardrail
without nagging.

## Validation
- `npm run typecheck` clean; build green (~1.34 MB / ~305 KB gzip).
- `npx vitest run`: 325 passed / 11 skipped (incl. AuthenticatedApp modal-parity test).
