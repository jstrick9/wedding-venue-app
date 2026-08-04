# Review 54 — Seed a starter decor catalog on first use + remove dead chair-legacy funcs

## 1. New users got an empty decor catalog (UX gap)
`venueData` defined a full starter catalog (`defaultDecorCategories`, `defaultDecorItems`
with sensible inventory counts) but **nothing referenced them** — both were dead exports.
`getDecorCategories()`/`getDecorItems()` in `useLayoutState` defaulted to `[]`, so a
first-time user opened the DecorDesigner / decor admin and saw nothing (they'd have to
click "Load standard categories" manually).

**Fix:** wired the defaults in as the fallback when the storage key is absent:
- `getDecorCategories()` → `defaultDecorCategories`
- `getDecorItems()` → `defaultDecorItems`
Since `loadFromStorage` returns the default only when the key is **absent**, explicitly
saved data (including a deliberate empty `[]`) is never overwritten. Retyped
`defaultDecorCategories` from `LayoutCategoryInfo[]` to `DecorCategoryDef[]` (removing
the `as any` casts) so it feeds the getter directly. Added tests
(decorCatalogSeed.test.ts) covering seed-on-absent, no-overwrite-of-empty, and
user-catalog priority.

## 2. Dead legacy chair-spec functions removed
`getChairSpecsFromLayout`/`setChairSpecsInLayout` (read/write the `CHAIR_SPECS_LEGACY`
key) were never referenced anywhere — backup uses the primary `getChairSpecs`. Removed
them (and the now-unused `ChairSpec` type import).

## Validation
- `npm run typecheck` clean; `npx tsc --noEmit --noUnusedLocals` clean.
- `npx vitest run`: 315 passed / 11 skipped (was 312; +3).
- `npm run build` green (~1.32 MB / ~300 KB gzip).
