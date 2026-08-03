# Re-Review — 08: Layout Canvas (fresh pass)

## Finding

### BUG (capacity) — On-canvas capacity counter ignored customCapacity & seating rows
`getTotalCapacity` (the "Capacity: X / Y" counter shown over the canvas) summed
only `spec.capacity`, so tables with a `customCapacity` override, or ceremony
**seating rows** (whose capacity is `chairCount × rowCount`), were counted
incorrectly. The GuestPanel already computed capacity the right way, so the two
views could disagree (e.g., a row of 12 chairs counted as the spec's default,
not 12).

**Fix:** `getTotalCapacity` now mirrors the GuestPanel logic:
- seating-type rows → `chairCount ?? customCapacity ?? capacity` × `rowCount`
- otherwise → `customCapacity ?? spec.capacity`

## Cross-module impact
- The canvas capacity counter and the GuestPanel now agree; the Event Overview's
  seating metrics (which use the GuestPanel-style computation) are consistent.

## Validation
- Typecheck clean; App tests pass.
