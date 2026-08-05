# Review 79 — Continued gap pass (multi-day countdown + tiered permissions)

Continued the autonomous bug-hunt and UI/UX improvement pass. Two findings
fixed, each CI-validated and committed to `main`.

## 1. Multi-day celebration countdown showed "passed" mid-event

**Bug:** In the Guest Portal, `daysUntilEvent` was computed only against
`eventStartDate`. On the middle/final day of a multi-day wedding (e.g. Fri–Sun)
the guest portal wrongly printed "The celebration has passed — thank you for
joining!" while the event was still ongoing.

**Fix:** Extracted a pure, timezone-safe `celebrationStatusDays(start, end,
isMultiDay, now)` helper in `src/utils/guestPortal.ts`:
- `> 0` → days until the first day,
- `0` → today is inside the event window,
- `< 0` → fully passed.
It parses date-only event strings by their Y-M-D components (so a date-only
string doesn't shift a day in negative-offset timezones) and compares calendar
days rather than raw timestamps. `GuestPortal` now uses it for the countdown
label. Added 8 unit tests (single-day before/on/after, multi-day middle/after/
before, first-day-at-23:00, null inputs).

## 2. Tiered collaborator permissions (approved via clarifying question)

**Bug/gap:** Every collaborator role (couple, planner, family, vendor) had
identical full edit rights in the Couples Portal — a family member or vendor
could edit the guest list, portal settings, meal options, designs, and invites.
Only removing collaborators was restricted to the couple.

**Approved model (user selected "Tiered permissions"):**
- **couple** — full control.
- **planner** — edit spaces, design, guests, questions; not portal branding or collaborators.
- **family** — help answer questions + view + chat.
- **vendor** — view + chat only.

**Implementation in `CouplesPortal.tsx`:**
- `canEditSpaces`, `canEditDesign`, `canManageGuests` → couple/planner.
- `canAnswerQuestions` → anyone but vendor.
- `canManagePortal` (portal settings), `canManageCollaborators` → couple only.
- Gates: space select toggle, design status/notes/submit, guest add/edit/remove/
  import/copy/email, portal-settings form (view-only summary for non-owners),
  collaborator invite/copy/email/remove — each with a visible "View-only — your
  role…" notice where applicable.
- `EventQuestionsWizard` gained a `readOnly` prop (disables inputs, step tabs,
  save buttons) so a vendor can view answers without editing.

**Tests:** Added 4 CouplesPortal permission tests (vendor view-only across
spaces/guests/portal; vendor no portal save; planner can manage guests but not
portal; couple sees portal save button). Full suite: **385 passing / 11 skipped**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green before each commit.

## Notes / operational
- Git identity and remote were wiped between turns again → re-added identity +
  remote (token URL). Token file had been overwritten with metadata; restored it
  to a clean single-value format.
- `node_modules` partially disappeared mid-turn → `npm install` restored it.
