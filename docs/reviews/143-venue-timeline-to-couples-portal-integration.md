# 143 — Venue Portal Timeline <-> Couples Portal Integration & Day of Coordination Gating

## Overview
As an acting **wedding-venue product, UX, full-stack, and QA expert**, I updated the **Timeline module** (`TimelinePanel.tsx`, `CoupleTimelineTab.tsx`, `useTimeline.ts`, `coupleService.ts`) so that wedding timelines tie directly back to the **Couples Portal** and follow explicit wedding-venue business rules regarding Day of Coordination services.

## Business Rule & Architectural Alignment
1. **Couples Portal Timeline Tab (`src/components/couple/CoupleTimelineTab.tsx`)**:
   - Added a dedicated **"📅 Timeline"** tab (`'timeline'`) to the **Couples Portal** (`CouplesPortal.tsx`).
   - Booked couples (and their invited collaborators, especially hired planners and day-of coordinator vendors) can create and manage their wedding timeline (adding event days, milestones, times, locations, and notes, marking milestones complete, and exporting/printing).
2. **Venue Portal Timeline Gating (`TimelinePanel.tsx`)**:
   - Added a **Couple Event Selector Dropdown** to `TimelinePanel.tsx`, listing booked couple events in two groups:
     - **`★ Day of Coordination Booked (Venue Managed)`**: Events where the couple has booked Seven Paths Manor's Day of Coordination service ($1,000) or where the venue has enabled coordination.
     - **`🔒 Planner / Self-Managed (Read-Only to Venue)`**: Events without venue Day of Coordination.
   - **When Day of Coordination is booked (`hasVenueCoordination(ev) === true`)**:
     - Displays a purple **"★ Venue Coordination Service Booked"** collaborative banner.
     - The venue admin has full permission to create, edit, add days, add events, delete events, and manage the couple's timeline. Changes sync instantly with the Couples Portal.
   - **When Day of Coordination is NOT booked (`hasVenueCoordination(ev) === false`)**:
     - Displays an amber **"Day of Coordination Not Booked"** informational banner explaining that the couple and their hired planner / coordinator vendor manage the timeline in the Couples Portal.
     - Enforces a **read-only preview mode** for the venue (hiding/disabling Add Day, Add Event, Edit, Delete, and Milestone Toggle buttons) so venue operations can inspect the schedule without editing.
     - Provides an interactive **"+ Add Day of Coordination Service ($1,000)"** action button that allows the venue admin to add the service to the couple's booking with one click, immediately unlocking collaborative timeline editing.
3. **Data Model & Synchronization (`useTimeline.ts`, `src/types/timeline.ts`)**:
   - Extended `WeddingTimeline` with optional `coupleId?: string` to link timelines to couple events.
   - Created `getTimelineForCouple(coupleId)` and `ensureTimelineForCouple` helpers.
   - Wired `emitDataChanged('all')` and `spm_data_changed` listeners across `useTimeline` and `saveCoupleEvents` so edits in either portal update both views immediately.

## Automated Tests Added
- `src/services/couples/coupleService.test.ts`: Added unit test for `hasVenueCoordination(ev)`.
- `src/components/couple/CoupleTimelineTab.test.tsx` (3 tests):
  - `renders "Self-Managed / Planner Timeline" banner when Day of Coordination is not booked`
  - `renders "★ Venue Coordinated Event" banner when Day of Coordination is booked`
  - `allows adding a new timeline day and timeline event`
- `src/components/CouplesPortal.test.tsx`: Added `renders the Timeline tab in Couples Portal and allows couple/planner to view and manage timeline`.
- `src/components/TimelinePanel.couplesPortal.test.tsx` (3 tests):
  - `displays "★ Day of Coordination Booked" banner and enables full timeline editing when couple booked coordination`
  - `displays "Day of Coordination Not Booked" banner in read-only preview mode when coordination is not booked`
  - `allows venue admin to click "Add Day of Coordination ($1,000)" to add service and unlock collaborative editing`

## CI & Verification
- Full test suite: **625 passing / 11 skipped** across 143 test files (`npx vitest run`).
- Clean TypeScript check (`npm run typecheck`), clean event-bus lint (`npm run lint:events`), clean unused-locals check, and green production single-file build (`npm run build`).
