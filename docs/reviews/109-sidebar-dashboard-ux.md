# Review 109 — Dashboard/Design Studio naming + sidebar UX polish

## What
Applied the naming consistency and Design Studio sidebar improvements requested.

## 1. Landing page (Dashboard) "Admin" → "Admin & System Settings"
- Sidebar nav item label updated.
- Quick actions widget: the **Admin** button is now the primary action labeled
  **"Admin & System Settings"**; the widget was upgraded from a cramped 2-col grid
  to full-width stacked buttons (Admin & System Settings, Design Studio, Calendar,
  Operations) so longer labels fit cleanly with icons.

## 2. Design Studio sidebar — Workspace Snapshot & Grid & Snap to Settings only
`Workspace Snapshot` (tables/fixtures/zoom summary + keyboard help) and
`Grid & Snap` (show grid, snap, grid size, grid contrast) previously rendered at the
top of **every** Layout Tool section, wasting vertical space in the catalog tabs.
They now appear **only in the Settings section** (alongside Zoom, Reset View,
Clear All).

## 3. Quick find is collapsible, default collapsed
The catalog "Quick find" search is now a collapsible panel (header button with a
chevron + `aria-expanded`) that starts **collapsed**, giving the section item list
more room by default.

## 4. Section names always visible
The Layout Tools section tabs previously hid labels when the sidebar was narrow
(icon-only). They now render as a wrapping set of labeled pills (icon + truncated
name) so **each section's name is always readable**, with the active section
highlighted in the brand color and `aria-pressed`.

## Tests
- `Sidebar.gridControls.test.tsx` — navigate to Settings before asserting grid/snap
  controls (they moved out of the default Tables view).
- `VenueDashboard.test.tsx` — `getAllByText('Design Studio')` (now appears in both
  nav + quick actions).
- `App.operations.test.tsx` — `findAllByRole` for the Operations button (appears in
  nav + quick actions).

Full suite: **468 passing / 11 skipped / 122 files**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`,
unused-locals scan all green.
