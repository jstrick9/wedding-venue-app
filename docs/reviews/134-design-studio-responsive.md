# 134 — Design Studio: mobile/tablet responsiveness

The Studio workspace previously rendered the fixed-width Sidebar + canvas +
Properties panel in one horizontal flex row, so on a tablet/mobile the canvas was
squeezed to a sliver (on 768px: 280 + 320 = 600px of panels → ~168px of canvas).

## Changes

1. **Side panels overlay on small screens.** On viewports ≤ 767px (`matchMedia`),
   the Sidebar and PropertiesPanel are absolutely positioned as overlays
   (z-30) over the canvas, so the layout canvas always gets the full viewport
   width. On `md+` they return to normal flex flow.
   - Small screens default to the collapsed rails (`sidebarCollapsed=true`,
     `showProperties=false`) so the canvas is maximized on load.
   - Leaving mobile restores the user's saved desktop prefs.
   - The mobile-forced collapse is **not** written to `localStorage` (guarded by a
     ref), so the desktop preference isn't clobbered.
   - Guarded against environments without `matchMedia` (jsdom) — no-ops there.

2. **Canvas drag/pan now uses pointer events.** `FloorPlanCanvas` handled items and
   panning with mouse events only, so dragging/panning didn't work on touch. It now
   uses pointer events (`onPointerDown`, `pointermove`, `pointerup`), which unify
   mouse + touch + pen, plus `touch-action` so the page doesn't scroll mid-drag.

## Tests
- `src/components/AuthenticatedApp.responsive.test.ts` (new, 3, static): overlay
  wrappers present, mobile defaults to collapsed + not persisted over desktop
  prefs, and the canvas uses pointer events / touch-action with no mouse-only item
  handler.
- Existing `App.operations.test.tsx` (renders the full app) stays green.

## CI
587 passing / 11 skipped (was 584). Typecheck, event-bus lint, unused-locals, and
single-file build all green.

## Files
- `src/components/AuthenticatedApp.tsx`
- `src/components/FloorPlanCanvas.tsx`
- `src/components/AuthenticatedApp.responsive.test.ts` (new)
