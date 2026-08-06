# Review 106 — Dashboard: actionable review KPIs

## What
The dashboard's "Awaiting layout review" and "Approvals due" KPI cards previously
told the venue how many layouts needed attention but offered no way to act.

## Changes in `VenueDashboard.tsx`
- The two `stats.pending`-driven cards are now `<button>`s that navigate to the
  **Couples & Events** section (with `title`, `aria-label`, and a visible focus
  ring for keyboard users).
- The Couples & Events section gained a **"Review & approve layouts in Admin"**
  action (shown only when a layout is pending / changes-requested) and a per-couple
  **"Review →"** link on any card whose layout needs approval.

## Tests / CI
`VenueDashboard.test.tsx` still passes (4 tests). Full suite:
**467 passing / 11 skipped / 122 files**; `npm run typecheck`, `npm run lint:events`,
`npm run build` all green.
