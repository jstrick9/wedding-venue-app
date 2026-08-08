# 141 — Operations Studio (`StaffOperationsPanel`): Complete Research, Bug-Fix & UX Enhancement Pass

## Overview
As an acting **wedding-venue product, UX, full-stack, and QA expert**, I conducted an architectural review and user-flow audit of the **Operations Studio module (`StaffOperationsPanel.tsx`)** — the venue's operational command center for tasks, areas, shifts, checklists, and data exports.

## Key Bugs / Gaps Identified & Resolved
1. **"Print Operations Summary" Stale Scope Bug**:
   - *Issue*: The **"🖨️ Print Operations Summary"** button was buried inside the Export tab and when clicked printed the entire interactive tab container (including JSON export/import buttons).
   - *Fix*: Moved the **"🖨️ Print Sheet"** button to the main header bar and implemented a dedicated `@media print` layout (`.ops-print-report`). Now clicking "Print Sheet" from ANY tab prints a clean, comprehensive **Daily Operations Report** containing Summary KPIs, Tasks by Event Phase, Shift Schedule, and Event-Day Checklists with checkable square boxes (`[ ]`) for clipboard use.

2. **Shift Start/End Time Timezone Off-By-One & Editing Bug**:
   - *Issue*: Shift `startTime` and `endTime` inputs used `.slice(0, 16)` on UTC ISO strings, which caused `<input type="datetime-local">` to display times shifted by 4+ hours in local US timezones.
   - *Fix*: Created safe timezone-neutral helpers (`toLocalDatetimeInput` and `fromLocalDatetimeInput` in `src/utils/dateTime.ts`) and wired them into the shift editor so local start and end times display and save accurately without timezone shift.

3. **Shifts Timeline Early-Shift Truncation Bug**:
   - *Issue*: Shifts starting before 6:00 AM returned `null` in the timeline view, silently hiding early-morning setup shifts.
   - *Fix*: Expanded timeline hours to 5:00 AM–Midnight (20 hours), clamped early shift start times to remain visible (`Math.max(5, ...)`), and enforced a minimum width (`Math.max(40, width)`) so short shifts are always clickable and legible.

4. **Operational Area Deletion Reference Integrity**:
   - *Issue*: Deleting an operational area left stale area IDs inside `task.assignedAreas` on existing tasks.
   - *Fix*: Updated `handleDeleteArea` to cascade-scrub the deleted area ID from all tasks in storage.

5. **Task Search & Staff Filter Bar**:
   - *Enhancement*: Added a real-time Search & Filter bar to the **Tasks** tab (`renderTasks()`), allowing venue admins to filter by staff assignee (`taskFilterStaff`) or text search (`taskSearch`) across both Kanban and List views.
   - Added `normalizedPhase` helper so tasks with custom or legacy phase names (`setup`, `teardown`) are cleanly mapped to the standard Kanban columns (`pre-event`, `during-event`, `post-event`) and never invisibly dropped.

6. **Checklists Tab "Show incomplete items only" Toggle**:
   - *Enhancement*: Added an interactive checkbox toggle (`hideCompletedChecklist`) in the **Checklists** tab, allowing staff on event day to hide completed checklist items and focus exclusively on pending tasks.

7. **Defensive Storage Backup**:
   - *Enhancement*: Enhanced `safeParse` in `useEffect` so that if `localStorage` contains corrupted JSON for tasks, areas, or shifts, it backs up the corrupt string to `${key}_backup_${Date.now()}` before resetting, preventing silent data loss.

## Automated Tests Added
- `src/utils/dateTime.test.ts`: Added unit tests for `toLocalDatetimeInput` and `fromLocalDatetimeInput`.
- `src/components/StaffOperationsPanel.test.tsx` (8 tests):
  - `renders all 6 navigation tabs and Print Sheet header button for authorized admin`
  - `adds a staff task, searches/filters tasks, and displays match count`
  - `adds an operational area and scrubs assignedAreas from tasks when area is deleted`
  - `adds a staff shift and formats start/end time using local datetime-local input without timezone shift`
  - `toggles "Show incomplete items only" on Checklists tab`
  - `renders .ops-print-report printable Daily Operations Report section`
  - `calls window.print() when the header Print Sheet button is clicked`
  - `backs up corrupt JSON in localStorage without crashing when loading`

## CI & Verification
- Full test suite: **615 passing / 11 skipped** across 148 test files (`npx vitest run`).
- Clean TypeScript check (`npm run typecheck`), clean event-bus lint (`npm run lint:events`), clean unused-locals check, and green production single-file build (`npm run build`).
