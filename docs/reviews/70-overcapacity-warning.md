# Review 70 — Flag over-capacity tables in the guest assignments view

In the GuestPanel assignments tab, a table with **more guests than its capacity** was
rendered the same green "full" style as a correctly-full table, because the
`available` value clamps to 0. A wedding planner would not see that a table is actually
over-booked.

**Fix:** the assignments card now detects over-capacity (`assignedGuests.length >
capacity`) and renders the table **red** with a clear "⚠️ Over capacity by N" label (and
a red count chip), distinct from green (exactly full) and yellow (near full). Quick-assign
already disables seats at full tables; over-full tables are now visibly flagged too.
Adds GuestPanel.overCapacity.test.tsx.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 326 passed / 11 skipped (was 325; +1).
