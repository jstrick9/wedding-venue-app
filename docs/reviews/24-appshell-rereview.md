# Re-Review — App Shell / Admin Reset (fresh pass)

## Finding

### BUG (stale UI) — Saved-layouts dropdown not refreshed on same-tab data change
After an Admin "Reset to defaults" (which clears saved layouts from storage),
the Header's saved-layouts list stayed stale because it only refreshed on
cross-tab `storage` events and backend pulls — not on same-tab
`spm_data_changed`. The dropdown would show deleted layouts until a reload.

**Fix:** `AuthenticatedApp` now also refreshes saved layouts whenever
`spm_data_changed` fires. Cheap localStorage reads, no loop.

## Validation
- Typecheck clean; App smoke tests pass.
