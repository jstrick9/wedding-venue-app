# Review 121 — Validate couple-event guest count on create/edit

## What
The venue's Couples & Events create/edit forms parsed `guestCount` with
`parseInt(...) || undefined`, which silently dropped NaN/negative/0 values instead
of telling the venue the input was invalid.

## Change (`CoupleManagement.tsx`)
Both `handleCreate` and `handleSaveEdit` now validate a non-empty guest count must
parse to an integer ≥ 1, showing a clear error otherwise. Empty stays "unset".

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**482 passing / 11 skipped / 124 files**), `npm run build` all green.
