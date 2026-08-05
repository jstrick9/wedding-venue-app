# Review 90 — Couple checklist, couple vendors & venue per-couple setup/staffing

Based on the user's product direction, built three self-contained modules that
connect the couple's planning choices to the venue's operational prep. Each is
committed separately, all CI-validated.

## 1. Couple's own event checklist
The couple (or their planner) creates their own prep checklist in the Couples
Portal's new "✅ Checklist" tab — title, optional phase (Planning/Setup/Day-of/
Take-down), due date, and a done toggle. Separate from the venue's plan, as the
couple builds it from their approved layouts and chosen decor.

## 2. Couple vendors
The couple picks from the **venue's preferred vendor list** (read-only one-tap
adds, from the venue's existing `spm_vendors` flagged `isPreferred`) or adds
their own custom vendors, and tracks `requested/contacted/booked/declined`.
New "🧰 Vendors" tab in the Couples Portal.

## 3. Venue per-couple setup & staffing
The venue keeps its own per-couple "🛠️ Setup & Staffing" panel (in Couples &
Events) — what needs doing (moving tables/chairs, decor install), which venue
space, which event day (multi-day aware), assigned staff, and a scheduled due
time, with `not-started/in-progress/done` tracking. Driven by the couple's
selected spaces and multi-day span, so the venue can schedule setup before each
event/space and keep its prep separate from the couple's checklist.

## Data & integration
- Types: `CoupleChecklistItem`, `CoupleVendor`, `CoupleSetupTask`.
- Services: `coupleChecklistService.ts`, `coupleVendorService.ts`,
  `coupleSetupService.ts` (with backup reads).
- Storage keys + versions + backup domains for all three; cascade-deleted when a
  couple event is deleted.
- `getVenueVendors()` synchronous read added to `useVendors.ts`.

## Tests
Unit tests for all three services + CouplesPortal renders checklist/vendors tabs.
Full suite: **410 passing / 11 skipped**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green before each commit.
