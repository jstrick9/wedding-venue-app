# Review 104 — B5: VendorPanel adopts the shared UI kit

## What
Migrated the preferred-vendor showcase (the venue's marketplace surface) onto the
shared `src/components/ui` primitives for cross-surface consistency.

## Changes in `VendorPanel.tsx`
- Empty "no vendors" message → `EmptyState` with an actionable hint.
- "+ Add vendor" / "💾 Save changes" → `Button` (primary).
- Category "Add" button → `Button` (primary).
- "Cancel" (edit mode) → `Button` (default).

(Search + category filter and "used by N couples" were already present from the
A2 vendor-showcase build.)

## Tests / CI
Pure markup swap, no behavior change. Full suite still **463 passing / 11 skipped /
121 files**; `npm run typecheck`, `npm run lint:events`, `npm run build` all green.
