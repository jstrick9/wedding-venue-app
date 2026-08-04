# Re-Review — Guest Panel editing (improvement)

## Finding
The guest edit form only exposed **Name, Group, and Assignment**, omitting fields
the `Guest` type supports and that planners need: email, phone, dietary
restrictions, accessibility, meal choice, special needs, RSVP status, and notes.
These could be imported via CSV but **not edited in the UI** — a significant gap.

The CSV export also omitted email/phone/meal/special-needs, so it couldn't
round-trip the richer import.

## Improvement
- Guest edit form now includes: email, phone, RSVP status, meal choice, dietary
  restrictions, special needs, accessibility toggle, and notes.
- CSV export now includes Email, Phone, Meal Choice, and Special Needs columns
  (matching the import mapping).

## Validation
- Typecheck clean; guest panel tests pass; full suite **301 / 11 skipped**; build
  succeeds.
