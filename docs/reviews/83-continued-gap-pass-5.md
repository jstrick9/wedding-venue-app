# Review 83 — Continued gap pass round 5

Autonomous bug-hunt and UI/UX improvement pass. Six findings fixed, each
CI-validated and committed to `main`.

## 1. Couple CSV import no longer drops existing guests + deduplicates
`importCoupleGuests` kept only non-couple guests and re-added only the new rows,
so importing a CSV silently **wiped the couple's manually-added guests**. Now it
merges (keeps pre-existing guests) and deduplicates by email/name so a re-import
doesn't create duplicates. (Caught by a new test that also surfaced this
pre-existing bug.)

## 2. Orphaned space layouts pruned on venue availability edit
Editing a couple's `availableSpaces` dropped selected spaces that were removed
but left stale `spaceLayouts` entries (status/notes for no-longer-available
spaces). `spaceLayouts` is now pruned to only the spaces still available.

## 3. Duplicate collaborator invites prevented
Inviting the same email twice created duplicate collaborators with separate
invite tokens. `addCoupleCollaborator` now rejects duplicates, and the People tab
shows a clear "already invited" message.

## 4. Couple portal shows a completed event correctly
The couple's portal header only distinguished "active" vs "invited", so a
venue-marked "completed" event incorrectly displayed as "● Invited". Now shows
"✓ Completed".

## 5. Guest RSVP email format validated
The RSVP form accepted any non-empty email, so a typo'd email was saved and could
never receive follow-ups. Added the platform's standard email-format check with a
clear warning toast.

## 6. Couple event date-range validation
The venue could set an end date before the start date on a couple event, which
silently produced a confusing single-day/multi-day mismatch. Now both create and
edit reject a reversed date range with a clear message.

## CI
All commits green: `npm run typecheck`, `npm run lint:events`, `npx vitest run`,
`npm run build`. Full suite: **393 passing / 11 skipped**.
