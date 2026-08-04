# Review 52 — Event Overview "Manage Guests" action now permission-aware

Follow-up to the guests-modal permission gate added in review 50: the Event Overview
quick action still showed a "Manage Guests" button to every user, but for a user
without `canManageGuests` the (now gated) Guests modal would no longer open — leaving a
button that silently does nothing.

**Fix:** added an optional `canManageGuests` prop (default `true`) to `EventOverview`
and hide the "Manage Guests" button when it is `false`. `AuthenticatedApp` passes
`canManageGuests={canOpenGuestPanel}`. Read-only stats remain visible to everyone; the
"Load a Template" / "Manage Vendors" actions are untouched. Added regression tests
(EventOverview.access.test.tsx).

## Validation
- `npm run typecheck` clean; `npx tsc --noEmit --noUnusedLocals` clean.
- `npx vitest run`: 312 passed / 11 skipped (was 310; +2).
- `npm run build` green.
