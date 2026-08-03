# Module Review — 09: Guest Panel & Guest Management

**Scope:** `src/components/GuestPanel.tsx`, `src/hooks/useLayoutState.ts` (guest import), `src/utils/guestCsv.ts` (new)

## Findings

### BUG-1 (UX, Medium) — CSV import used a blocking `alert()` and gave no feedback
`importGuestsFromCSV` called the native `alert('CSV must have a "name" column')` on a missing name column and otherwise returned nothing — no confirmation of how many guests were added, and a blocking dialog inconsistent with the app's toast system.

### BUG-2 (Functionality, Medium) — CSV import only read name + group
The import ignored the `email`, `phone`, `dietaryRestrictions`, and `accessibility` columns the rest of the app already supports, so a planner's full guest-list CSV lost useful data on import.

### BUG-3 (Functionality, Medium) — Re-importing a guest list created duplicates
No deduplication, so importing the same file twice (or merging a party list) duplicated every guest.

## Improvements implemented
- **New pure utility `src/utils/guestCsv.ts`**: `parseGuestCsv(csv, existing)` parses name/group/email/phone/dietary/accessibility, deduplicates by (name + group), and returns a structured `GuestImportResult` (`{ok, error, added, skipped, guests}`) — no `alert()`.
- **`importGuestsFromCSV`** now delegates to the pure util and returns the result.
- **`GuestPanel`** surfaces the result via toast: a warning on failure (e.g. missing name column) and a success message with added/duplicate-skipped counts.
- Empty accessibility cells map to `undefined` (unknown) rather than `false`.

## Cross-module dependencies affected
- `useLayoutState.importGuestsFromCSV` return type changed (was `void`, now `GuestImportResult`); only `GuestPanel` consumes it, so blast radius is small.
- `GuestImportResult` is imported from `useLayoutState` (re-exported from the util) to keep callers unchanged.

## Validation
- New `guestCsv.test.ts` (5 tests): column mapping, missing-name error, dedup by name+group, header/empty handling, blank-name skipping.
- Typecheck clean; full suite **258 passed / 11 skipped**; build succeeds.

## Note
- Capacity is already enforced in the quick-assign UI (full tables/rooms are hidden/disabled) and covered by existing room-capacity tests; this module's changes do not affect that path.
