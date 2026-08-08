# 138 — Design Studio: refresh saved-layout list after saving

## Bug
Saving a layout (or overwriting one) wrote to storage but did not refresh the
Header's saved-layout list in the same tab. In local mode (the active provider)
`layoutBackendSync.saveToBackend()` is a no-op and `setSavedLayouts` does not emit
`spm_data_changed`, so the newly saved layout would not appear in the "Load Layout"
dialog until a reload.

## Fix
`handleSaveLayoutWithSync` and `handleSaveLayoutOverwriteWithSync` now call
`refreshSavedLayouts()` after saving, so the Header's saved-layout list updates
immediately in the same tab. (The delete handler already updates the list directly.)

## Files
- `src/components/AuthenticatedApp.tsx`

## CI
593 passing / 11 skipped (count unchanged — behavior wired through existing handler).
