# 140 — Design Studio: Layout Review & Commenting Pins + Custom Print/Export Legend Toggles

## Overview
This update implements the two optional enhancements recommended in our Design Studio venue-admin review:
1. **Layout Review & Commenting Pins (`FloorPlanCanvas.tsx`, `CoupleLayoutPreview.tsx`, `CoupleManagement.tsx`)**: Allows venue admins to drop review pins and comment annotations onto specific canvas X/Y coordinates when reviewing a couple's submitted layout in the approval queue.
2. **Custom Print/Export Legend Toggles (`PrintView.tsx`)**: Adds interactive checkbox toggles inside `PrintView` so venue admins can selectively show/hide dietary notes, linen color keys, or room setup checklists on printed floor plan sheets.

## Features Implemented
### 1. Layout Review & Commenting Pins
- Added `LayoutReviewPin` type (`id`, `x`, `y`, `comment`, `createdAt`, `authorName`) to `src/types.ts` and extended `CoupleSpaceLayoutRecord` with optional `reviewPins?: LayoutReviewPin[]`.
- Updated `FloorPlanCanvas.tsx` to render `reviewPins` as clickable red numbered circle badges (`#1`, `#2`, etc.) at precise venue coordinates (`venueX + (pin.x || 0) * scale`).
- Enhanced `CoupleLayoutPreview.tsx` with:
  - **"📍 Add review pin"** toggle mode that shows visual grid lines (`showGrid={true}`) while adding pins.
  - Clicking on the canvas opens an inline comment input popover (`"Enter review note (e.g. Move table 5ft left)"`).
  - Submitting a note triggers `onAddReviewPin({ x, y }, comment)`.
  - Added a Review Pins list below the canvas showing pin number, comment text, author name, coordinates, and a `"✕"` delete button (`onRemoveReviewPin`).
- Wired `reviewPins`, `onAddReviewPin`, and `onRemoveReviewPin` in `CoupleManagement.tsx` so review pins persist to `ev.spaceLayouts[spaceId].reviewPins` for the couple event.

### 2. Custom Print/Export Legend Toggles
- Added three toggle checkboxes inside `PrintView.tsx`'s sticky top action bar:
  - **Dietary & Meal notes** (checked by default): Controls whether guest meal choices, dietary restrictions, and accessibility notes appear next to guest names on the printed seating chart.
  - **Linen color key** (checked by default): Renders a printable Linen Color Key above the floor plan, listing every linen color used on placed tables with color swatches and table counts.
  - **Room setup checklist** (checked by default): Renders a dedicated Room Setup Checklist section with checkboxes for table placement, linen verification, chair setup, aisle clearance, power/lighting access, and setup lead signature lines.

## Automated Tests Added
- `src/components/CoupleLayoutPreview.test.tsx`:
  - Added `renders existing layout review pins in the preview and list`.
  - Added `allows adding a review pin when onAddReviewPin is provided`.
  - Added `calls onRemoveReviewPin when deleting a pin from the list`.
- `src/components/PrintView.test.tsx`:
  - Added `renders print sheet toggles checked by default and shows Linen Color Key & Setup Checklist`.
  - Added `toggling checkboxes hides/shows dietary notes, Linen Color Key, and Room Setup Checklist`.

## CI & Verification
- Full test suite: **607 passing / 11 skipped** across 148 test files (`npx vitest run`).
- Clean TypeScript check (`npm run typecheck`), clean event-bus lint (`npm run lint:events`), clean unused-locals check, and green production single-file build (`npm run build`).
