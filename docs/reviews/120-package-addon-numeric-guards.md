# Review 120 — Guard package & add-on numeric fields

## What
The venue's **Packages & Add-ons** admin forms parsed numeric fields with
`value ? Number(value) : 0`, which had two problems:
- Clearing a field produced `0`. For a package's `maxGuests`, `0` is interpreted as
  "no limit" everywhere downstream — so the venue could accidentally save an
  unlimited package and every couple would silently be "within limit".
- A non-numeric or negative value became `NaN` / a negative number, breaking pricing
  and capacity math (and the over-capacity warnings).

## Change (`PackageManagement.tsx`)
- Package save now clamps prices and guest counts to non-negative finite numbers,
  and **requires `maxGuests > 0`** (with a clear message) instead of silently saving 0.
- Add-on price is guarded against NaN/negative.

## Verified as non-issues this round
- The couple portal already warns when their invited guest count exceeds the package
  limit.
- Venue space management uses validated presets + shared save.

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**482 passing / 11 skipped / 124 files**), `npm run build` all green.
