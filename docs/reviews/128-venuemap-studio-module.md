# 128 — Full-Venue Map becomes a dedicated Studio module (`#/venuemap`)

## Problem
The interactive full-venue map designer was reachable only by routing into the
Admin `wayfinding` tab (`localStorage[ADMIN_LAST_TAB]='wayfinding'` → `#/admin`).
Per the platform's own guiding principle ("floor-plan/diagramming is its own
module"), a full-property diagramming tool belongs in the **Design Studio** as a
first-class module, not hidden inside the admin settings console.

## Change
- **New dedicated view + route** in `AuthenticatedApp`: `view === 'venuemap'`
  backed by hash route `#/venuemap`. The view mounts `VenueMapDesigner`
  full-page with its own header ("🗺️ Venue Map Designer") and a back button.
- **Studio entry points now route to the module** (not Admin):
  - `StudioLayoutsHome`'s "Design the full-venue map" shortcut → `#/venuemap`
    (removed the old `ADMIN_LAST_TAB` + `#/admin` side effect).
  - New "🗺️ Venue Map" button in the Studio breadcrumb bar (admin-gated).
- **Admin Wayfinding & Rules** no longer embeds the editor (single source of
  truth). It now shows a map summary (spaces / parking / entries / walkways) and
  an "Open map designer →" button that routes to the Studio module. Rain
  contingency, rules, and weather remain in the Admin tab.
- **RBAC**: map editing is gated to `canOpenAdminPanel`; non-admins hitting
  `#/venuemap` see an access-denied message (mirrors the admin view).

## Tests
- `VenueWayfindingManagement.test.tsx` (new, 3 tests): open-map button calls
  `onOpenVenueMap`; hidden when the callback is absent; summary counts render
  from the saved config.
- `AuthenticatedApp.venuemap.test.ts` (new, 3 tests, static): dedicated view
  union + hash route present; `VenueMapDesigner` imported/rendered with
  `getVenueMapConfig`/`emptyVenueMapConfig`/`saveVenueMapConfig`; the shortcut no
  longer writes `ADMIN_LAST_TAB` or routes to `#/admin`.
- Full suite: **543 passing / 11 skipped** (was 535). Typecheck, event-bus lint,
  unused-locals, and single-file build all green.

## Follow-up — map canvas size editing
Added a "📐 Map size" block to the designer side panel (width/height inputs +
"Apply size"), backed by a pure `updateMapSize(map, w, h)` helper that clamps the
dimensions to 20–500 and re-clamps every point into the new bounds (so shrinking
the canvas never leaves points off-map). `updateMapSize` is covered by two new
helper tests (resize+clamp, bound-clamping / NaN fallback). Test count
**543 passing / 11 skipped**.

## Files
- `src/components/AuthenticatedApp.tsx`
- `src/components/admin/VenueWayfindingManagement.tsx`
- `src/components/AdminPanel.tsx`
- `src/components/admin/VenueWayfindingManagement.test.tsx` (new)
- `src/components/AuthenticatedApp.venuemap.test.ts` (new)
- `docs/venue-portal/venue-portal-review.md`
