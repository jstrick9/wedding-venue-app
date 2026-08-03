# Module Review — 12: Design & Asset Management

**Scope:** Admin asset managers — `TableManagement`, `ChairManagement`, `FixtureManagement`, `WallManagement`, `LinenManagement`, `SpacingManagement` (under `src/components/admin/`), and their save handlers in `AdminPanel.tsx`.

## Findings

### UX (cross-cutting) — Auto-save success message flashed on every keystroke
All asset managers auto-save on every `onChange` (which is the app's persist-on-edit model), and every save called `showSuccess('Tables saved!')` etc. With `showSuccess` firing on each keystroke, the "saved" indicator would keep appearing/refreshing while a user typed a table name, linen color, etc. — noisy across all 15 admin tabs.

**Fix:** Debounced `showSuccess` in `AdminPanel` — the message now surfaces once after a short idle (600 ms) and clears after 3 s, instead of re-appearing on every keystroke. A cleanup on unmount clears any pending timer. This improves UX across every admin editor with a single, low-risk change.

## Verified-good (no change)
- **Delete confirmation**: destructive actions (delete table/chair/fixture/linen/wall) all go through `confirmAction` (danger) before persisting — no accidental data loss.
- **Duplicate**: creates a copy with a `(Copy)` suffix and fresh id.
- **Persistence**: every `handleSave*` persists to storage, updates local state, and emits the data-changed event so the workspace refreshes.
- **Reset**: destructive "Reset everything" is already confirm-gated (Module 10 note).
- Asset editors were grouped under labeled admin sections in Module 10.

## Cross-module impact
- `AdminPanel.showSuccess` is shared by all 15 tabs; debouncing is purely a timing change, so no data/logic is affected.

## Validation
- Typecheck clean; AdminPanel tests pass; full suite **263 passed / 11 skipped**; build succeeds.
