# 142 — Operations Studio (`StaffOperationsPanel`): Shift Schedule Conflict Detection & Bulk Checklist Reset

## Overview
This update implements the two optional operational enhancements recommended in our venue-admin Operations Studio review (#141):
1. **Shift Schedule Conflict Detection (`renderShifts()`, `isShiftConflicting`)**: Real-time detection of overlapping staff shifts for the same staff member, alerting venue admins before event day.
2. **Bulk Checklist "Reset for Next Event" Action (`renderChecklists()`)**: A bulk operational reset tool allowing venue admins to uncheck all completed checklist items across every task and reset completed tasks to `'not-started'` state for the next wedding.

## Features Implemented
### 1. Shift Schedule Conflict Detection
- Added `isShiftConflicting(shift)` helper using interval overlap logic (`startA < endB && startB < endA`) to identify when a staff member is scheduled for overlapping shifts.
- When `conflictingShiftsCount > 0`, an amber alert banner displays at the top of the **Shifts** tab:
  > *"**Schedule Conflict Detected:** [X] shifts overlap in time for the same staff member."*
- On every conflicting shift in Timeline view and List view:
  - Added an animated pulsing amber warning badge `⚠️` with ARIA label `"Schedule conflict warning"` and tooltip `"Schedule Conflict: Overlaps with another shift for this staff member"`.
  - Added an amber warning ring/border highlight (`ring-2 ring-amber-300 border-amber-300`) to the timeline shift block.

### 2. Bulk Checklist "Reset for Next Event" Action
- Added a **"🔄 Reset for Next Event"** button in the **Checklists** tab header (disabled if no completed items exist or user lacks permission).
- Clicking the button opens a `ConfirmDialog` (`title="Reset Checklists for Next Event?"`, `tone="danger"`) warning that all completed checklist items will be reset across every task.
- When confirmed:
  - Unchecks all checklist items (`completed: false`, `completedAt: undefined`, `completedBy: undefined`) across all tasks.
  - Resets any task in `'completed'` status to `'not-started'`.
  - Persists tasks to storage (`saveTasks`) and displays success toast `"All operational checklists reset for next event."`.

## Automated Tests Added
- `src/components/StaffOperationsPanel.test.tsx` (10 tests total):
  - Added `detects and flags overlapping staff shifts for the same staff member`: Seeds two overlapping shifts for a staff member, switches to Shifts tab, and asserts that the alert banner and warning badges (`⚠️`) are rendered.
  - Added `resets all completed checklist items across tasks when "Reset for Next Event" is confirmed`: Seeds a completed task with completed checklist items, clicks "Reset for Next Event", confirms the dialog, and verifies storage is reset to `not-started` and `completed: false`.

## CI & Verification
- Test suite: **10 passing tests** in `StaffOperationsPanel.test.tsx`.
- Clean TypeScript check (`npm run typecheck`), clean event-bus lint (`npm run lint:events`), clean unused-locals check, and green production single-file build (`npm run build`).
