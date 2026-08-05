# Review 87 — Continued gap pass round 9

Autonomous bug-hunt and UI/UX improvement pass. Four findings fixed, each
CI-validated and committed to `main`.

## 1. Couple headcount warning
The couple could add more guests than their expected headcount without any
signal. The Guests tab now shows an amber warning when invited guests exceed the
couple's expected count.

## 2. Venue sees per-meal catering counts per couple
The venue could only see attending/declined/no-reply per couple, not what meals
guests chose. The couple's guest viewer now shows a per-meal count summary
(including plus-one meals).

## 3. Couple space capacity warning
When a couple selected a venue space whose capacity is below their expected
headcount, nothing flagged it until layout review. The space card now shows a
clear warning (e.g. "This space seats 80 but you expect 120 guests").

## 4. Venue couple search + no-spaces guidance
- Added a name-search field to the venue's Couples & Events admin (with a
  "No matching couples" empty state).
- If the venue has no venue spaces, the "Spaces available to this couple" picker
  (create + edit) now shows a hint to add spaces in Venue management first.

## CI
All commits green: `npm run typecheck`, `npm run lint:events`, `npx vitest run`,
`npm run build`. Full suite: **394 passing / 11 skipped**.
