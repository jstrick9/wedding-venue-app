# Review 97 — Embedding the full layout canvas in the couple's Design tab (round 19)

Delivered the final deferred item: couples can now draw real layouts in-portal per
space, and the venue sees them for approval.

Approved design (via clarifying questions): **full embedded editor per space** and
**show drawn layouts in the venue approval queue**.

## 1. Data model
- `CoupleSpaceLayout` (tables/fixtures/decor + updatedAt) and
  `CoupleSpaceLayoutRecord` (status, notes, optional layout).
- `spaceLayouts[spaceId]` now carries an optional drawn layout.
- `saveCoupleSpaceLayout(id, spaceId, layout)` upserts a space's layout and marks
  it designed (preserving "submitted" when already submitted).

## 2. Couple-side editor
New `CoupleLayoutEditor` — a self-contained per-space editor that reuses the
venue's `FloorPlanCanvas` + catalog (tables/chairs from table specs, fixtures from
fixture types, decor from decor items):
- space picker via the Design tab's "Open layout editor" / "Edit layout" button,
- palette → click-canvas-to-place, drag to move, select + delete, zoom/pan, grid,
- save persists per couple+space and marks the space designed.

## 3. Venue approval
New `CoupleLayoutPreview` (read-only FloorPlanCanvas) rendered in the venue's
Layout Approval Queue for each space that has a drawn layout, next to status/notes.
The couple's Design tab shows saved item counts and re-labels the editor button.

## Tests
`saveCoupleSpaceLayout` service tests + `CoupleLayoutEditor` render tests.
Full suite: **438 passing / 11 skipped**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green. Unused-locals scan clean.
