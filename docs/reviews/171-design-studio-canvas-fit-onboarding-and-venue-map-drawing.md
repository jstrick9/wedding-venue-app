# Review #171: Design Studio Canvas Auto-Fit, Onboarding Notification Lifecycle & Full Venue Map Designer Base Map & Drawing Integration

## 1. Executive Summary & Objective
- **Goal**:
  1. Default the **Design Studio Canvas (`AuthenticatedApp.tsx`)** "to fit the entire canvas to the screen" whenever a user opens the Design Studio or switches venues.
  2. Update the **"Let's build your layout" onboarding notification (`FloorPlanCanvas.tsx`)** so that when a user first opens the Design Studio, it only stays on the screen for 2.5 seconds (within the requested 2-3 second window).
  3. Enforce that after the first time a new user opens the Design Studio, the "Let's build your layout" notification is marked as seen in persistent storage (`'spm_studio_onboarding_seen'`) and never shows again on subsequent visits.
  4. Perform an exhaustive product/UX/technical audit of the **Full Venue Map Design module (`VenueMapDesigner.tsx` and `VenueMapCanvas.tsx`)** and upgrade it with:
     - **Base Map Image Upload & Opacity Control (`backgroundImageUrl`, `backgroundOpacity`)**: Allows venue admins to upload an aerial photograph, property diagram, or architectural site map (or paste a URL) and adjust opacity from 10% to 100%.
     - **Full Drawing Capabilities & Property Zone Annotations (`drawings?: DrawingObject[]`)**: Allows venue admins to draw shapes, property boundaries, parking lot outlines, and ceremony areas directly onto their property map using the Full Map Drawing Studio (`<DrawingTool />`) or 1-click **Quick Property Zone Presets** (`🌳 Ceremony Lawn Zone`, `🅿️ Main Parking Lot`, `🏛️ Main Manor Building`, `🌿 Gardens Boundary`).

## 2. Changes Made
- **Design Studio Canvas Auto-Fit (`src/components/AuthenticatedApp.tsx`)**:
  - Added a `useEffect` on `view === 'studio'` that calls `fitAndCenterVenue()`, ensuring that whenever a user opens the Design Studio, the canvas automatically calculates container and canvas dimensions and scales/pans to fit the entire canvas to the screen.
  - Updated `layoutState.setOnVenueChange` to invoke `fitAndCenterVenue()` so switching between venues in the studio also fits the entire canvas to the screen.

- **Onboarding Notification Lifecycle (`src/components/FloorPlanCanvas.tsx`)**:
  - Implemented persistent state checking `localStorage.getItem('spm_studio_onboarding_seen') !== 'true'`.
  - On first visit to an empty canvas, the `"Let's build your layout"` hint is displayed and a 2500ms `setTimeout` timer auto-dismisses the notification and saves `'spm_studio_onboarding_seen' = 'true'` to persistent storage.
  - On any subsequent visit, the onboarding notification is never displayed, even when the canvas is empty.
  - Created automated test suite `src/components/FloorPlanCanvas.onboarding.test.tsx` verifying first-visit auto-dismissal and subsequent-visit suppression.

- **Full Venue Map Designer (`src/components/VenueMapDesigner.tsx`, `src/components/VenueMapCanvas.tsx`, `src/types.ts`, `src/utils/venueMapDesigner.ts`)**:
  - **Type Extension (`src/types.ts`)**: Added optional `backgroundImageUrl?: string`, `backgroundOpacity?: number`, and `drawings?: DrawingObject[]` to `VenueMapConfig`.
  - **Base Map Uploader Card (`VenueMapDesigner.tsx`)**: Built a dedicated `"🖼️ Base Map Image"` card in the designer Side Panel allowing accessible file uploading (`id="venue-base-map-upload"`, `className="sr-only"`, `<label htmlFor="venue-base-map-upload">`, and reliable `FileReader` data URI handling), URL pasting, live opacity adjustment, and base map removal.
  - **Full Drawing Studio Integration (`VenueMapDesigner.tsx`)**: Added a `"🎨 Map Drawing & Zones"` card with:
    - `"✏️ Open Full Map Drawing Studio"` button that launches `<DrawingTool />`, allowing freehand annotations, boundaries, parking lots, and text to be saved directly to the venue map.
    - `"＋ Add 4 Preset Zones"` button that populates `map.drawings` with vector area boxes (`🌳 Ceremony Lawn Zone`, `🅿️ Main Parking Lot`, `🏛️ Main Manor Building`, `🌿 Gardens Boundary`).
    - `"Clear Shapes"` button to reset custom vector drawings.
  - **SVG Rendering Parity (`VenueMapCanvas.tsx`)**: Upgraded `VenueMapCanvas` to render `<image href={map.backgroundImageUrl} opacity={...} />` and all vector drawing shapes (`rect`, `circle`, `polyline`, `text`) underneath points and routes, ensuring 100% parity across live editing, couple preview, PNG export, PDF export, and Print.
  - Created automated test suite `src/components/VenueMapDesigner.backgroundAndDrawing.test.tsx` verifying Base Map URL application, Preset Zone shape creation, shape clearing, and Drawing Studio modal launch.

## 3. Verification Summary
- **Typecheck**: Clean (`npm run typecheck` — 0 errors).
- **Event Bus Linter**: 0 raw `spm_*` strings outside typed bus (`npm run lint:events`).
- **Test Suite**: Passed all 742 tests across 165 test files (`npx vitest run`), including `FloorPlanCanvas.onboarding.test.tsx`, `VenueMapDesigner.test.tsx`, `VenueMapCanvas.test.tsx`, `VenueMapDesigner.backgroundAndDrawing.test.tsx`, and `VenueWayfindingManagement.test.tsx`.
- **Production Bundle**: Single-file bundle build verified (`npm run build`, `vite:singlefile`).
