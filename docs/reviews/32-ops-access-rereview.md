# Re-Review — 15: Operations (access fix) (fresh pass)

## Finding

### BUG (High) — Staff Operations panel was never rendered (Ops module inaccessible)
`StaffOperationsPanel` was lazy-imported in `AuthenticatedApp`, and the Header's
**Operations** button (shown for admin/staff via `canAccessOperationsPanel`)
called `open('operations')` and set `showOperations` — but **no
`{showOperations && <StaffOperationsPanel/>}` was ever rendered**. So clicking
Operations did nothing; the module was inaccessible.

(The existing `StaffOperationsPanel.access.test.tsx` rendered the panel directly,
so it passed but never caught that the app never mounted the panel.)

**Fix:** Rendered `<StaffOperationsPanel>` in the modal block when
`showOperations` is true, passing the correct props (onClose, currentUser,
isAdmin, venueId, eventName, users, venues). Admin/staff can now open and use
the full Ops module (Overview, Tasks, Areas, Shifts, Checklists, Export/Import).

**Regression guard:** Added `App.operations.test.tsx` which mounts the app as an
admin, clicks Operations, and asserts the "Staff & Operations" panel renders.

## Cross-module impact
- Completes the Staff Operations feature end-to-end (role-gated to admin/staff).

## Validation
- Typecheck clean; new regression test passes; full suite **297 / 11 skipped**;
  build succeeds.
