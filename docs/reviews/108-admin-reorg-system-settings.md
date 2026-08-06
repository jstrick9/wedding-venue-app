# Review 108 — Admin & System Settings reorg + kill the horizontal scrollbar

## What
Per user directive, the venue Admin was reorganized into a settings console with
clear categories, the Guest Portal config was removed from the venue (it lives in
the Couples Portal), and the admin navigation was redesigned to eliminate the
horizontal-scrollbar UX.

## Changes in `AdminPanel.tsx`
- **Title/subtitle** → "Admin & System Settings": "Manage venues & inventory,
  layout content, couples, branding, and access."
- **New category structure** (category rail on the left):
  - **Venues & Inventory** — Venues, Tables/Chairs/Linens, Fixtures & Walls, Decor
    *(Decor moved here from Design & Content)*
  - **Layout Content** *(was Design & Content)* — Spacing *(moved here as its own
    section, out of Tables/Chairs/Linens)*, Templates, Guidelines
  - **Couples Portal** *(was Couples & Events)* — Couples, Packages & Add-ons,
    Wayfinding & Rules, Event Questions *(moved here from Design & Content)*
  - **System Brand & Access** *(was Portal & Brand)* — Branding, Users, Access
    Control, Invite Members *(Users/Access/Invites moved here; People & Access
    removed)*
  - **System & Backup** — Backup & Restore
- **Guest Portal section removed** — the venue no longer configures the guest
  portal; couples configure their own via the Couples Portal → Portal Settings tab.
- **Navigation redesign**: replaced the single `overflow-x-auto` tab strip with a
  **category rail + wrapping section pills**. No horizontal scroll; keyboard users
  get `aria-current` and visible states. Search ("Quick find") still works across
  all sections and is surfaced inline.
- Removed the now-unused tab-bar scroll-into-view effect and refs.

## Supporting changes
- `SeatingAndLinensManagement.tsx` — dropped the `spacing` sub-tab (Spacing is now
  its own top-level section); active sub-tab uses the brand color.
- `AdminDecorSection.tsx` — sub-tabs now wrap (no horizontal scroll) and use brand
  accents.
- `Header.tsx` — admin button label → "Admin & System Settings".

## Tests
- `AdminPanel.tablesSeating.test.tsx` — updated to assert Spacing is no longer a
  sub-editor and is reachable via the Layout Content category.
- `Header.test.tsx` — updated for the renamed admin button.

Full suite: **468 passing / 11 skipped / 122 files**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`,
unused-locals scan all green.
