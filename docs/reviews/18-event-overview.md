# New Feature — 18: Event Overview Dashboard ("Intelligence")

A new module that turns the app's existing planning data into **decision support** for a venue owner/coordinator — one-screen "pulse" on the event.

## What it does
Opens from a **📊 Overview** button (floating on the canvas, available to all signed-in roles) and shows:
- **Health indicator** (On Track / Needs Attention / Over Capacity).
- **Guest/RSVP stats**: total, confirmed, pending, declined, response rate.
- **Seating coverage**: seated, unseated, total table seats, seating utilization.
- **Automated notes** (actionable): over-capacity, low response rate, unseated guests, no seating configured, no guests yet.
- One-click actions to **Manage Guests** or **Load a Template**.

## Design / architecture
- **`src/utils/eventDashboard.ts`** — a pure, testable `computeEventDashboard(guests, submissions, tables, tableSpecs)` that returns the metrics + messages + a `health` grade. No React, fully unit-tested (5 tests).
  - Excludes ceremony seating-rows from table-seat capacity (they aren't dining seats).
  - Only flags "many unseated" once seating actually exists (a fresh layout shouldn't look broken).
- **`src/components/EventOverview.tsx`** — a thin presentational panel consuming the computation.
- Wired into `AuthenticatedApp` via a new `overview` modal in `ModalContext` (lazy-loaded).

## Value ("Intelligence Platform")
Capacity-vs-RSVP reconciliation is the classic venue panic point (overbooked or over-decorated tables). This surfaces it before the wedding, along with response-rate and coverage, directly from the data already in the app — no extra data entry.

## Validation
- 5 unit tests on the computation; typecheck clean; full suite **263 passed / 11 skipped**; build succeeds.

## Roadmap hook
Extends naturally into the planned additions: per-event vendor payment summaries, guest-count reconciliation reports, and timeline dependency checks can each be added as more cards on this dashboard.
