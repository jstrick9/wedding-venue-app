# Review 100 — B4: Layout Studio "Spaces & Layouts" home

## What
Gave the Layout Studio its own module identity instead of dropping the venue
straight onto the canvas. The studio breadcrumb now has a **🏛️ Spaces & Layouts**
button that opens a home panel (routed within the `#/studio` view).

## Contents of `StudioLayoutsHome`
- **Capacity summary strip** — three stat cards: venue spaces, total seating
  capacity, and spaces with a master layout.
- **Venue spaces / space picker** — one card per space: category icon + name,
  seating capacity, dimensions, master-layout status (✓ saved with table count +
  timestamp, or "No master"), a "Current / Open now" badge, and an "Open in
  editor"/"Edit this space" action that switches the active venue in the editor.
- **Quick template gallery** — category-filterable template cards; choosing one
  applies it (with the overwrite-confirm guard when real work is on canvas).

## Shared logic
Extracted `handleTemplateSelect` in `AuthenticatedApp` so both the new gallery and
the pre-existing `TemplateSelector` modal share one flow: warn on non-empty layout,
switch space if the template targets another venue, load, reset view, close all.

## Tests
`StudioLayoutsHome.test.tsx` — renders spaces/capacity/master badges, space-picker
callback, category filtering, and template-select callback. Full suite:
**461 passing / 11 skipped / 120 files**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build` all green.
