# Re-Review — Guest Portal / Portal Admin date robustness (pass 2)

## Finding
Remaining unguarded date renders could crash with "Invalid time value" if a
config value (event start/end date, RSVP deadline, or schedule item times) is a
malformed/date-only string:

- `GuestPortal`: event date range (hero + home + header), RSVP deadline, and
  `new Date(config.eventStartDate)` in the header.
- `GuestPortalManagement`: schedule item start/end times in the admin list.

## Fix
- Added `safeDate(value)` to `GuestPortal` (guards `toLocaleDateString`) and
  applied it to all event-date / deadline renders; reused for the header.
- Added `safeFormatDateTime` / `safeFormatTime` helpers in
  `GuestPortalManagement` and applied them to the schedule item list.

These complement the earlier `safeTime` guard (schedule tab).

## Validation
- Typecheck clean; guest portal + admin tests pass; full suite **307 / 11
  skipped**; build succeeds.
