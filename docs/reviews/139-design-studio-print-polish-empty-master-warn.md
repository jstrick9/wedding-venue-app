# 139 — Design Studio: Print/export scope polish & empty Master Layout warning

## Overview
This update tackles two items noted in previous venue-admin Design Studio reviews:
1. **Print/export scope polish**: Previously, triggering browser print (`window.print()`, Cmd+P / Ctrl+P, or browser File → Print) from the Design Studio (`#/studio`) or Full-Venue Map (`#/venuemap`) printed the entire app chrome (header navigation, sidebar palette, properties panel, breadcrumb bar, floating zoom controls) along with the canvas, often clipping or cropping flex containers.
2. **"Save as Master Layout" with empty layout warning**: Previously, clicking "Save as Master Layout" on an empty working layout (`0` tables, `0` fixtures, and `0` decor items) instantly overwrote any existing master layout for the venue without confirmation.

## Changes Implemented
- **Scoped Print Styles (`src/index.css`)**:
  - Added `.no-print` and `.spm-studio-chrome` classes that hide app chrome (`display: none !important`) when printing.
  - Added `body:has(.spm-print-view)` rules so that when the dedicated `PrintView` modal is open, everything in `#root` except `.spm-print-view` is hidden in print mode.
  - Added `.spm-print-canvas-container` and `.spm-studio-root` rules to reset `overflow: hidden` and flex heights to `overflow: visible !important`, `height: auto !important`, ensuring floor plans and maps expand across printed pages cleanly without scrollbars or cropping.
- **Design Studio & Venue Map Chrome Tagging**:
  - Applied `.no-print .spm-studio-chrome` to `<Header />`, `AuthenticatedApp`'s studio breadcrumb bar, sidebar wrapper, properties panel wrapper, bottom-left capacity badge, and `VenueMapDesigner`'s header toolbar, palette bar, and side panel.
  - Added a `🖨️ Print` button to `VenueMapDesigner`'s export bar next to PNG and PDF export.
- **Empty Master Layout Confirmation (`src/components/AuthenticatedApp.tsx`)**:
  - Added `confirmEmptyMasterLayout` confirmation state in `handleSaveMasterLayout`.
  - When the working layout has no placed items (`tables.length === 0 && fixtures.length === 0 && decor.length === 0`), clicking "Save as Master Layout" opens a `ConfirmDialog` warning that saving an empty master layout will replace any existing master layout with an empty canvas.
  - Confirming saves the empty master layout and marks the working layout clean; cancelling closes the dialog without saving.

## Automated Tests Added
- `src/components/PrintView.test.tsx` (7 tests): Verifies `.spm-print-view` container class, `.no-print` action bar styling, `window.print()` invocation, capacity and guest count calculations, PNG/PDF export buttons, and missing-SVG warning toast.
- `src/components/AuthenticatedApp.emptyMaster.test.tsx` (2 tests): Verifies that saving an empty layout as a Master Layout opens the warning dialog, saves on confirm, and cancels cleanly when dismissed.

## CI & Verification
- Full test suite: **602 passing / 11 skipped** across 148 test files.
- Clean TypeScript check (`npm run typecheck`), clean event-bus lint (`npm run lint:events`), clean unused-locals check, and green production single-file build (`npm run build`).
