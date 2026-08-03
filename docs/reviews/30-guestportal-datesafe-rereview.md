# Re-Review — 11: Guest Portal (fresh pass) — date robustness

## Finding

### BUG (crash risk) — Schedule rendering / ICS export crashed on invalid dates
The schedule item times were rendered with `new Date(item.startTime).toLocaleTimeString(...)`. If a schedule item ever contained a time-only or malformed date (e.g. imported from a backup with a different format), `new Date("09:00")` is an **Invalid Date** and `toLocaleTimeString` throws "Invalid time value", crashing the whole schedule tab. Similarly, `handleAddToCalendar` called `toISOString()` on dates it didn't validate, which throws on invalid dates.

**Fix:**
- Added a `safeTime(value)` helper that returns a readable time for valid dates and falls back to the raw string for invalid ones; used for schedule item times.
- `handleAddToCalendar` now guards invalid start dates (returns early) and its `formatICSDate` returns '' for invalid dates.

## Cross-module impact
- Guest portal schedule tab and "Add to calendar" no longer crash on malformed schedule data.

## Validation
- Typecheck clean; guest portal tests pass; full suite green; build succeeds.
