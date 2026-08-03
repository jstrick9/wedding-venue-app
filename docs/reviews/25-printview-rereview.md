# Re-Review — 17: Print / Export (fresh pass)

## Finding

### BUG (capacity) — Print preview ignored customCapacity & seating rows
`PrintView`'s `getTotalCapacity` and the per-table seat label used only
`spec.capacity`, so tables with a `customCapacity` override and ceremony
**seating rows** were printed with the wrong capacity — inconsistent with the
guest panel / canvas counter.

**Fix:** Added a single `tableCapacity(table)` helper (seating rows =
chairCount×rowCount; otherwise customCapacity overrides spec capacity) used by
both the total and the per-table label.

## Cross-module impact
- Printed capacity summaries now agree with the guest panel and on-canvas
  counter (which were already fixed to use the same rule).

## Validation
- Typecheck clean.
