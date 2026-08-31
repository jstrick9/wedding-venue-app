# Review #250 — Phase 1 Unit 1.2: `admin/UserManagement.tsx` (1,825 → 1,583 lines)

**Date:** 2026-08-31 · **Mode:** continuous campaign (protocol §3 Phase 1)

## Findings

**F-250-1 (P1 runtime bug — fixed): profile-image upload crashed on file selection.** The props destructure included `FileReader` — a name that does not exist on `AdminCommonProps` — which shadowed the browser's global `FileReader` with `undefined` for the entire component. The upload handler's `new FileReader()` (line 932) therefore threw `TypeError: FileReader is not a constructor` the moment a user picked a profile image. Hidden by `@ts-nocheck` since the file was created. Fix: the name is gone from the destructure (one of 57 invalid names removed), so the global resolves again.

**F-250-2 (P3 UX bug — fixed): two `showInfo()` calls passed only a message.** The API is `showInfo(title, message, kind?)`; the "Copy Link" and "Email Invite" buttons in the couples-portal invite card passed a single argument, so the dialog's message body rendered `undefined`. Both calls now pass a proper title and message.

**F-250-3 (maintainability — fixed): the destructure was paste garbage at scale.** 267 names destructured off `props`; 57 did not exist on `AdminCommonProps` at all (including `alert`, `FileReader`, `window`-adjacent globals, and local variable names from other components' scopes — `file`, `reader`, `raw`, `parsed`, `err`, `ids`…). Of the 210 valid names, ~180 were never used. The destructure now contains only the ~30 names actually read; the file shrank by 242 lines. Removing unused bindings is runtime-inert; removing the 57 phantom bindings is what fixed F-250-1.

**F-250-4 (type-model fix): `newUser` was `Record<string, unknown>`.** The create-user form's draft state is now a real `NewUserDraft` interface on `AdminTabTypes` (derived from AdminPanel's actual state shape), so all 12+ form inputs reading `newUser.email` etc. are typed instead of `unknown`. This also tightens `setNewUser` from `Dispatch<SetStateAction<any>>`.

## Scope of change

- `UserManagement.tsx`: de-nochecked, destructure pruned, unused imports dropped, validator fallback typed (`Record<string, string>`), 2 `showInfo` calls corrected. No render logic touched.
- `AdminTabTypes.ts`: `NewUserDraft` added; `newUser`/`setNewUser` typed.
- `UserManagement.typing.test.ts` (4 tests): pins the no-global-shadowing rule, the 2-arg `showInfo` contract, the real draft type, and a bounded destructure whose every name exists on the interface.
- Ratchet ceiling: 21 → **20**.

## Gates

ESLint 0 errors / 30 warnings · tsc clean · strict unused-locals scan clean · vitest **1006 passed** / 5 skipped (+4) · single-file 556.77 kB gzip and split chunks within budget · audit clean.

## Registry delta

Row 1.2 → `done` (#250). Phase 1: 4/24. Next: 1.3 `BrandingManagement.tsx` (1,716).
