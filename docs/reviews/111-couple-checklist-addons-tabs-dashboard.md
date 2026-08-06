# Review 111 — Autonomous gap-hunt: checklist grouping, add-on guest events, tabs, dashboard

A round of findings from a focused pass over the couple portal, guest portal, and
venue dashboard. Each was CI-validated and committed.

## 1. Couple checklist — group by phase
The couple's checklist stored a free-form `phase` (Planning/Setup/Day-of/…) but
rendered a flat list. It now groups items by phase (extracted to a tested pure
helper `src/utils/groupByPhase`), showing each phase as its own scannable section
with a done-count. Items without a phase fall into "General". Committed `f8c07f8`.

## 2. Bug: adding an activity add-on later didn't create its guest event
`ensureDerivedGuestEvents` only seeded when a couple had **no** guest events, and
the couple-portal effect keyed on add-on *count*. So a couple that added a
"horse & carriage" activity after the default ceremony/reception events existed
never got a matching guest event (and guests couldn't RSVP to it). Made the service
idempotent per-item (adds any missing derived event by title+kind, never duplicates
core events) and keyed the effect on add-on **ids**. Committed `84b2d6c`.

## 3. Couples portal — kill horizontal-scroll tab bar
The 11-tab bar used `overflow-x-auto`. Replaced with wrapping pill tabs (role
`tablist`, `aria-selected`), consistent with the admin nav redesign — no horizontal
scroll. Committed `44fbf9c`.

## 4. Bug: dashboard "This week" widget showed events up to 30 days out
The widget labeled "This week" filtered on a 30-day window. Now uses a true 7-day
window. Committed `1af53f6`.

## 5. Bug: dashboard didn't show multi-day couple events on non-primary days
The today strip and upcoming pipeline only considered `eventDate`. Now expand
multi-day couple events to every booked day, matching the venue calendar. Committed
`06ab3c8`.

## 6. Guest portal — RSVP submit says "Update RSVP" for returning guests
Returning guests who have already RSVP'd now see "Update RSVP" instead of
"Submit RSVP". Committed `505375a`.

## Tests
`src/utils/groupByPhase.test.ts` (new) and `coupleGuestEventService.test.ts` (+1
idempotency case). Full suite: **478 passing / 11 skipped / 123 files**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`,
unused-locals scan all green across all 6 pushes to `main`.
