# Review 76 — Fix multi-day RSVP "which days" checkboxes

For a multi-day event, the RSVP "Which days will you attend?" section rendered only a
**single hardcoded "Day 1"** checkbox — so a guest couldn't indicate attendance on days
2 or 3, even though `attendingDays` was meant to support multiple days.

**Fix:** the section now generates one checkbox per event day, derived from the
`eventStartDate`/`eventEndDate` span (capped at 7 days so a bad date range can't render
an unwieldy list). Single-day events still hide the section. Adds
GuestPortal.attendingDays.test.tsx (3-day → Day 1/2/3; single-day → hidden).

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 331 passed / 11 skipped (was 329; +2).
