# Review #161 — User Management (`UserManagement.tsx`): Application Recovery Crash Fix & Staff-to-Event Assignment Command Matrix

**Date:** 2026-08-10  
**Author:** jstrick9 (Wedding Venue Product / Full-Stack / UI/UX / QA Expert)  
**Status:** Completed & Tested

---

## 1. Executive Summary & Root Cause Analysis

### Problems Reported
1. **Application Recovery Crash (`getUserFieldErrors is not a function`):**  
   In **User Management > Internal Staff > User Accounts**, clicking the User Accounts header immediately triggered the **Application Recovery** crash screen with the runtime error `TypeError: getUserFieldErrors is not a function`.
2. **Staff-to-Event Operational Assignment Gap:**  
   With internal venue staff accounts (`Master Admin`, `Admin`, `Manager`, `Staff`) decoupled from single static event records, venue administrators and managers needed an intuitive, high-density way to assign internal staff members to work different booked couple events across Seven Paths Manor.

### Architectural Root Cause of the Crash
When `UserManagement.tsx` rendered the internal staff user list, line 741 called `const editUserFieldErrors = getUserFieldErrors(...)` for every user row. While `getUserFieldErrors` was defined in `AdminPanel.tsx` (line 559) and used by the legacy user modal, it was **never included in `commonProps` in `AdminPanel.tsx`** or declared in `AdminCommonProps` in `AdminTabTypes.ts`. Consequently, `props.getUserFieldErrors` evaluated as `undefined`, causing `UserManagement` to throw `getUserFieldErrors is not a function` whenever the User Accounts section was opened.

---

## 2. Technical & UI/UX Remediation

### A. 100% Crash-Proof `getUserFieldErrors` Integration
- **`src/components/admin/AdminTabTypes.ts`:** Added `getUserFieldErrors?: (u: any, requireAuthFields?: boolean) => Record<string, string>;` to `AdminCommonProps`.
- **`src/components/AdminPanel.tsx`:** Explicitly added `getUserFieldErrors,` to `commonProps` so that `UserManagement.tsx` always receives the live validator function.
- **`src/components/admin/UserManagement.tsx`:** Added a defensive fallback `const validator = getUserFieldErrors || (() => ({}));` before calling `validator(...)` so that even in isolated unit tests or custom renderings, `UserManagement` never throws a runtime TypeError.

### B. Staff-to-Event Assignment Command System (`UserManagement.tsx` & `src/types.ts`)
We added optional `assignedEventIds?: string[];` and `assignedEventRoles?: Record<string, string>;` fields to the `User` interface (`src/types.ts`) and built a dual-entry operational assignment system for Admins and Managers:

1. **Top-Level "🗓️ Staff-to-Event Assignment Command Matrix" Modal:**  
   - Added an interactive **"🗓️ Assign Staff to Events"** button to the top Quick Actions Bar of **User Management**.
   - Opening the matrix displays a side-by-side card for every booked wedding event across Seven Paths Manor (`getCoupleEvents()`, showing date and guest count).
   - Within each event card, Admins and Managers can:
     - View all assigned internal staff members and their operational roles (`u.name` + `u.assignedEventRoles[ev.id]`).
     - 1-click **Remove ✕** any assigned staff member.
     - Use the **"+ Quick Assign Staff Member"** selector to choose any internal staff member from a dropdown, pick their staffing role (`Lead Coordinator`, `Setup Captain`, `Day-of Staff`, `Banquet Captain`, `Audio/Visual Specialist`, `Security Lead`), and click **"Assign →"** to assign them immediately.
2. **Per-Staff "🗓️ Booked Wedding Event Assignments" Card (`isExpanded`):**  
   - When an Admin or Manager expands any Internal Staff member's profile in User Management, an interactive **"Booked Wedding Event Assignments"** card appears between Personal Information and Account Settings.
   - It lists all booked couple events with real-time status badges (`✓ Assigned` vs `Unassigned`), a staffing role dropdown, and a 1-click **"+ Assign to Event →"** / **"✕ Remove Assignment"** action button.

---

## 3. Automated Test Coverage & Verification

- **New Automated Test Suite (`src/components/admin/UserManagement.internalStaffRbac.test.tsx`):**
  - `allows Admins and Managers to open the Staff-to-Event Assignment Command Matrix and assign an internal staff member to work a booked couple event`: Verifies that clicking **"Assign Staff to Events"** launches the Staff-to-Event Assignment Command Matrix modal and lists booked couple events.
  - `allows assigning or removing an internal staff member from a booked wedding event inside their expanded user account profile`: Verifies that expanding an internal staff account displays the **"Booked Wedding Event Assignments"** card and renders couple event assignment buttons.
- **Vitest Regression Suite:** All 12 existing tests across `UserManagement.test.tsx`, `AccessControlPanel.test.tsx`, `rbacAdminFlow.test.ts`, and `UserManagement.internalStaffRbac.test.tsx` pass cleanly alongside the new assignment tests.
- **Full CI:** Passed `npm run typecheck`, `npm run lint:events`, unused locals validation, and single-file production bundle build (`npm run build`).
