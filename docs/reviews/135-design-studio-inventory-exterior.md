# 135 — Design Studio: exterior/architectural fixture inventory tracking

## Bug
The sidebar catalog counted placed fixtures only for **interior** items
(`else if (!isExterior)`). An **exterior/architectural feature** with an
`inventoryCount` never had its placed instances counted, so `usedCount` stayed 0 —
it never showed remaining inventory or an out-of-stock state, allowing the venue to
over-place exterior features beyond their inventory.

## Fix
Extracted the inventory logic into a tested pure helper module
(`src/utils/inventoryUsage.ts`):
- `countFixtureUsage(placed, specId, isExterior)` — counts placed fixtures of a
  spec, splitting interior vs exterior so each tracks its own inventory.
- `countTableUsage(placed, specId)` — table usage.
- `inventoryState(used, totalInventory)` — remaining + out-of-stock (no limit ⇒
  never out of stock).

`Sidebar.renderItem` now uses these helpers, so exterior features correctly report
usage and block placement when out of stock (the same toast/disabled handling as
interior items).

## Tests
- `src/utils/inventoryUsage.test.ts` (new, 4): interior/exterior split, interior
  count, table count, and remaining/out-of-stock (incl. no-limit case).

## CI
592 passing / 11 skipped (was 588). Typecheck, event-bus lint, unused-locals, and
single-file build all green.

## Files
- `src/components/Sidebar.tsx`
- `src/utils/inventoryUsage.ts` (new) + `src/utils/inventoryUsage.test.ts` (new)
