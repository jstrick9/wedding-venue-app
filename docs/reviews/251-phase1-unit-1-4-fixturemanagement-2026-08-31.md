# Review #251 — Phase 1 Unit 1.4: `admin/FixtureManagement.tsx` (1,383 → 1,140 lines)

**Date:** 2026-08-31 · **Mode:** continuous campaign

## Findings

**F-251-1 (type-model gap — fixed): `FixtureType` never declared `description`.** The fixture seed data has carried it since inception (`defaultFixtureTypes`: Large Screen — "17' 11\" opening", etc.) and the panel's live search filters on `f.description`, but the interface omitted the field, making the search branch type-invisible. Added `description?: string` to the type. Note the triage arc: the naive read of the tsc error was "dead search branch — delete it," which would have **broken working search**; checking the runtime data (venueData.ts) showed the type was wrong, not the code. Every compiler error gets triaged against domain data before "fixing."

**F-251-2 (P1 functional bug — fixed): the venue-category toggle on fixtures never worked.** The chip's onClick computed the next `venueCategories` array (`selected ? current.filter(...) : [...current, cat.id]`) and then saved the fixtures list **unchanged** — `{ ...f }` — discarding the computed value. Clicking a category chip (Ceremony / Reception / Lodging …) on any fixture did nothing, for the feature's entire life. Fixed: the save now applies `{ ...f, venueCategories }` to the edited fixture. This is the campaign's cleanest demonstration yet: `tsc`'s unused-locals check would have flagged the discarded value the day it was written, had `@ts-nocheck` not been suppressing it.

**F-251-3 (paste-garbage cleanup):** the same 57-name clone-stamp destructure garbage (phantom `FileReader`/`alert` included — harmless here, no `new FileReader()` in this file), plus 182 unused valid bindings. Destructure 265 → ~30 names; unused imports dropped (types import 14 → 5).

## Pinned by

`FixtureManagement.typing.test.ts` (3 tests): FixtureType declares description + search reads it; the toggle APPLIES the computed value (discard pattern gone); no global shadowing.

## Gates

tsc clean · strict unused-locals scan clean · eslint 0 errors / 30 warnings · vitest **1012 passed** / 5 skipped (+3) · single-file 555.41 kB gzip + split chunks within budget · audit clean · ratchet 19 → **18**.

## Registry delta

Row 1.4 → `done` (#251). Phase 1: 6/24. Next: 1.5 `VenueManagement.tsx` (1,162).

## Campaign note

Pre-scanned the remaining 18 files for the F-250-1/F-250-5 crash class: 8 more panels carry the phantom `FileReader`/`alert` destructure names, but **none call `new FileReader()`** — no further crashes of that class are lurking. The phantom names still get removed per-unit.
