# Review 126 — Venue couples admin: show selected space names

## What
The venue's couple list card showed only "🏛️ N/M spaces" (a count). For planning,
the venue benefits from seeing which spaces the couple actually selected.

## Change
Added a tooltip (title) on the spaces badge listing the selected space names,
falling back to the space id and "None selected" when empty.

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**482 passing / 11 skipped / 124 files**), `npm run build` all green.
