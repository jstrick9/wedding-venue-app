# Review 102 — B5: VenueCalendar adopts the shared UI kit

## What
Migrated the venue calendar's primary controls onto the shared `src/components/ui`
design system for cross-surface consistency (A5/B5).

## Changes in `VenueCalendar.tsx`
- **View switcher** (month/week/day/agenda) → `Button` with `tone="primary"` for
  the active view and `tone="default"` otherwise, plus `aria-pressed` for a11y.
- **"+ Add event"** → success `Button`.
- **Category legend** → `Badge` components (danger for blocked, warning for
  staffing, primary for couple, default otherwise), retaining the colored dot.
- **Empty states** → shared `EmptyState` in the day view ("No events on this day")
  and the agenda view ("No events scheduled"), with actionable hints.

Keyboard focus is handled by the existing global `:focus-visible` styles and the
`prefers-reduced-motion` media query in `index.css`.

## Tests / CI
No behavioral change (pure markup swap). Full suite still
**463 passing / 11 skipped / 121 files**; `npm run typecheck`, `npm run lint:events`,
and `npm run build` all green.
