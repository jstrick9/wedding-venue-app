# Re-Review — Printable guest list details (improvement)

## Finding
The printable guest list only showed guest **names**, omitting dietary
restrictions, meal choices, and accessibility — which the venue/catering team
needs on the day.

## Improvement
Added a `guestNotes` helper that appends meal choice (non-standard), dietary
restrictions, and accessibility to each printed guest row, in both the per-table
list and the unassigned list.

## Validation
- Typecheck clean; full suite **302 / 11 skipped**; build succeeds.
