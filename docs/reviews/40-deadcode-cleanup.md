# Re-Review — Dead code removal

## Findings — 3 fully-dead modules (no imports, no tests, no render)
- `src/components/admin/DecorManagement.tsx` — a decor admin manager never
  imported or rendered (the real decor admin is `AdminDecorSection`/`AdminPanel`).
- `src/hooks/useHistory.ts` — an undo-history hook never imported anywhere.
- `src/hooks/useAppModals.ts` (+ its test) — a modal-state hook superseded by
  `ModalContext`; only its own test referenced it.

## Fix
Removed all three dead files and their lone test, plus a stale comment in
`App.smoke.test.tsx` referencing the removed `useAppModals.test.ts`.

## Cross-module impact
None — verified no imports (static or dynamic) reference these before removal.
Bundle size effectively unchanged (dead code wasn't bundled).

## Validation
- Typecheck clean; full suite **300 / 11 skipped**; build succeeds.
