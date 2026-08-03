# Module Review — 15: Operations (Staff, Timeline, Vendors)

**Scope:** `src/components/StaffOperationsPanel.tsx`, `src/components/TimelinePanel.tsx`, `src/components/VendorPanel.tsx`, `src/hooks/useTimeline.ts`, `src/hooks/useVendors.ts`

## Findings

### UX — Blocking `alert()` on operations import
`StaffOperationsPanel` used native `alert('Import successful!')` and `alert('Invalid JSON file.')` — blocking dialogs inconsistent with the app's toast system.
**Fix:** Replaced with `showToast(...)` (success / warning). The pre-import `confirm('Import will merge…')` is retained (it's a reasonable destructive-action guard, and matches the app's `clearLayout` confirm pattern).

## Verified-good (no change)
- Staff tasks/areas/shifts CRUD with phase/priority/checklist/export; role-gated (`canAccessOperationsPanel`).
- Timeline CRUD via `useTimeline`; timeline delete is confirm-gated.
- Vendors CRUD via `useVendors`; vendor delete is confirm-gated.
- All three have passing access tests.

## Cross-module impact
- `StaffOperationsPanel` now imports `Toast`; no logic changed.

## Validation
- Typecheck clean; StaffOperationsPanel tests pass; full suite **263 passed / 11 skipped**; build succeeds.

## Note
- Staff data is persisted directly to `localStorage` in the panel rather than through a central service (there is no `setStaffTasks` service layer yet). It works, but centralizing it under the Module 1 backup-domain registry would make it backup/restore-safe by default. Flagged as a follow-up.
