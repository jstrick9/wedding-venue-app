# 133 — Design Studio: venue-admin round 2

Third venue-admin pass on the Design Studio module. Focused on action consistency,
data-loss protection, and dependency conflicts.

## Fixes

1. **Properties panel Duplicate/Delete are now undoable.** The Duplicate and Delete
   buttons in `PropertiesPanel` called `layoutState.duplicateItem`/`removeItem`
   directly with no undo snapshot — unlike the keyboard shortcuts (Ctrl+D, Delete),
   which push one. A venue admin who duplicated/deleted from the panel couldn't
   Undo. Wrapped both in `handleDuplicateItem`/`handleRemoveItem` that push an undo
   snapshot first.

2. **"Clear Master Layout" now confirms.** This destructive action (removing a
   space's saved master layout) had no confirmation, unlike "Clear All Items" and
   "Delete saved layout". Added a `ConfirmDialog` before clearing.

3. **Venue-switch and template-overwrite guards now use the dirty tracker.**
   `handleVenueChange` and `handleTemplateSelect` previously decided whether to
   prompt based on item *count* (`hasWork`). Switching venues or applying a
   template now uses `layoutDirty`, so any unsaved edit — including a metadata
   change with the same item count — is protected from silent loss.

## Tests
- `Header.test.tsx` (+1): "Clear Master Layout" asks for confirmation and only
  clears after the venue admin confirms.

## Follow-up — decor arrangement data-integrity
4. **Deleting a decor arrangement now scrubs stale references.** Placed
   tables/fixtures with an `appliedArrangementId` pointing at a deleted design kept
   a stale reference (a "Design Active" badge that no longer resolves and a broken
   "Edit Design" action). Added a pure `scrubArrangementRefs` helper and wired a
   listener in `AuthenticatedApp` that, on any decor-arrangements change, removes
   `appliedArrangementId` from items whose design no longer exists.
   Tests: `src/utils/decorCleanup.test.ts` (new, 2).

## CI (final)
584 passing / 11 skipped (was 582). Typecheck, event-bus lint, unused-locals, and
single-file build all green.

## Files
- `src/components/AuthenticatedApp.tsx`
- `src/components/Header.tsx`
- `src/components/Header.test.tsx`
- `src/utils/decorCleanup.ts` (new) + `src/utils/decorCleanup.test.ts` (new)
