# Review 51 — Enable grid & snap (implemented-but-hidden) + more dead-code removal

## 1. Grid & snap were fully implemented but hardcoded off (feature gap)
`AuthenticatedApp` hardcoded `const showGrid = false; gridSize = 1; gridContrast = 0.45;
snapToGrid = false;` and passed no-op handlers to the Sidebar:
`onShowGridChange={() => {}}`, `onGridSizeChange={() => {}}`, etc. Yet `FloorPlanCanvas`
fully renders a grid when `showGrid` is true and `AuthenticatedApp.applyGridSnap` snaps
placements to `gridSize`. The entire feature was dormant with no UI.
**Fix:** promoted the four values to React state (default grid size 5 ft — a 1 ft grid
would be unusably dense) and added a **Grid & Snap** control card in the Sidebar
(show grid, snap to grid, grid size selector, contrast slider), wired to the real
setters. `onSnapToGridChange`/`onGridContrastChange` are optional props so they are
invoked via optional chaining for test-rendered Sidebars. Added regression tests
(Sidebar.gridControls.test.tsx).

## 2. Dead data setters removed (`data/venueData.ts`)
`setAlignmentSettings`, `setIndoorFeatureTemplates`/`add/delete…`, and
`setOutdoorFeatureTemplates`/`add/delete…` were never referenced anywhere (app, tests,
backup, or entity layer — only the getters feed backup). Removed the seven dead
setters; the corresponding getters/defaults remain in use.

## 3. Dead permission helpers removed (`constants/permissions.ts`)
`getPermissionById`, `getPermissionsByCategory`, `getFeaturePermissions`,
`getSubFeaturePermissions`, `getLockedPermissions`, `getDefaultPermissions`,
`getAllPermissionIdsForFeature`, and `hasAllChildrenSelected` were never imported
anywhere. `getChildPermissions` (used by AccessControlPanel) and
`getInheritedPermissions` (used by useRBAC) are kept.

## Validation
- `npm run typecheck` clean; `npx tsc --noEmit --noUnusedLocals` clean.
- `npx vitest run`: 310 passed / 11 skipped (was 307; +3 grid-control tests).
- `npm run build` green (~1.32 MB / ~299 KB gzip).
