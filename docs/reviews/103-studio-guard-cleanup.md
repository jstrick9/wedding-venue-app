# Review 103 — Studio home guard, venue-access scoping, dead-modal cleanup

Three small correctness/consistency fixes found while finishing B5.

## 1. Studio home now respects the venue-switch guard (data-loss bug)
`StudioLayoutsHome` "Open in editor" previously called `layoutState.changeVenue`
directly, silently discarding unsaved placed work. It now routes through the
guarded `handleVenueChange` (and its switch-venues confirm dialog) exactly like the
header venue switcher.

## 2. Studio home is scoped to `selectableVenues`
The home panel previously listed `layoutState.venues` (all venues), which could
expose venues to basic/staff users who shouldn't see them. It now renders
`selectableVenues`, respecting the admin-vs-basic filter and the venue-category
filter applied across the studio.

## 3. Removed dead `'guests'` modal
`ModalType` still had `'guests'` (and initial-state entries) from the pre-removal
guest-management era, but nothing opened it. Removed it from the union and both
`modals` initial objects.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**463 passing / 11 skipped / 121 files**), `npm run build` all green.
