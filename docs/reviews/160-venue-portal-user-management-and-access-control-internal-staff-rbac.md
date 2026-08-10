# Review #160 — Venue Portal User Management & Access Control (`#/admin`): Internal Staff RBAC Elevation & Zero-Event-Tying Architecture

**Date:** 2026-08-10  
**Author:** jstrick9 (Wedding Venue Product / Full-Stack / UI/UX / QA Expert)  
**Status:** Completed & Tested

---

## 1. Executive Summary & Root Cause Analysis

### Problem Discovered
While the venue portal's **User Management** module (`src/components/admin/UserManagement.tsx`) had previously been split into two tabs (`👥 Internal Venue Staff & Admins` and `💍 Couples & Guest Portal Accounts`), the internal staff section still contained significant legacy clutter from an older data model:
1. **Event-Tying in Internal Staff:** Internal venue team members were being prompted for "Event Role" (`eventRole`), "Event Name" (`eventName`), "Event Date" (`eventDate`), and an entire collapsible section existed for **"Manage Event Roles"** (creating options like Bride, Groom, Florist).
2. **Legacy `basic` and `guest` User Concept:** Internal staff roles defaulted to `'basic'` or could be set to `'guest'`. In a professional wedding venue, **internal staff users do not get tied to an event**—they work across the venue as a whole and hold administrative or operational roles (`Master Admin`, `Admin`, `Manager`, `Staff`), whereas couples and guests belong to external portals.
3. **Confusing DMs Banner:** The admin direct messaging banner referred to "Master Basic Users by Event" instead of internal staff communication.

---

## 2. Comprehensive Technological & UI/UX Transformation

### A. Zero-Event-Tying for Internal Staff (`UserManagement.tsx`)
- **Removed "Manage Event Roles" Section:** Completely removed the legacy `Manage Event Roles` collapsible section and state from internal staff management.
- **Administrative-Only Staff Attributes:** Removed `Event Role`, `Event Name`, and `Event Date` input fields from both the **Create New User Modal** and the **Edit User Details Panel**.
- **Professional Operational Fields:** Internal venue staff accounts now cleanly manage:
  - **Email Address** * (Primary Login Identifier)
  - **Full Name** *
  - **Password** *
  - **RBAC Role** * (`Master Admin`, `Admin`, `Manager`, `Staff`, or custom venue roles)
  - **Internal Job Title / Role Title (Optional):** Labeled explicitly as internal venue title (e.g., "Lead Coordinator", "Banquet Director"), not an event role.
  - **Department (Optional):** E.g., "Operations", "Sales & Events".
  - **Contact Phone & Phone Type**
  - **Account Status:** `Active` / `Inactive` / `Pending` / `Suspended` / `Disabled`.

### B. Clean RBAC Role Hierarchy & Elimination of `basic` / `guest` in Internal Staff
- **Filtered Internal Staff RBAC Dropdowns:** In both user creation (`CreateUserModal`) and user editing (`Account Settings`), legacy `basic` and `guest` roles are filtered out (`allRoles.filter(role => role.id !== 'basic' && role.id !== 'guest')`).
- **Dynamic Role Mapping:** When an admin changes an internal user's RBAC role, the system cleanly assigns `role: selectedRole.hierarchy >= 90 ? 'admin' : 'staff'` without ever falling back to `'basic'` or `'guest'`.
- **Operational Stat Cards & Filters:**
  - Replaced the "Basic Users" stat card with an **Operations Staff** metric (`users.filter(u => u.role !== 'admin').length`).
  - Updated the role filter dropdown to filter between `👑 Admins` and `🛡️ Operations Staff`.
  - Upgraded the Quick Actions legend to display: `👑 Administrator (Full System Access) • 🛡️ Staff/Manager (Operations Access) • ⏸️ Inactive`.
- **Internal Staff Messaging:** Replaced the legacy "Admin ↔ Master Basic User" chat banner with **"💬 Internal Venue Staff Messaging"**, allowing administrators to launch direct message threads with any internal team member across the venue.

### C. Access Control Panel Elevation (`AccessControlPanel.tsx` & `useRBAC.ts`)
- **System `Manager` Role Added:** Added the **`Manager`** system role (`id: 'manager'`, `hierarchy: 70`, `name: 'Manager'`) to `DEFAULT_ROLES` in `src/hooks/useRBAC.ts` so venue admins have an out-of-the-box management tier between `Admin` and `Staff`.
- **Role Hierarchy & Scope Badges:** In `AccessControlPanel.tsx`, selecting any role now displays explicit badges indicating its hierarchy score (`Hierarchy: 100`, `90`, `70`, `40`, etc.) and its operational scope (`👑 Administrator Role`, `🛡️ Internal Staff Role`, or `💍 External Portal Role`), plus system immutability badges.

---

## 3. Automated Test Coverage & Verification

- **New Test Suite (`src/components/admin/UserManagement.internalStaffRbac.test.tsx`):**
  - `renders internal staff operational stat cards and excludes legacy Manage Event Roles section`: Verifies that `Total Users`, `Operations Staff`, and `Administrators` stat cards render cleanly and `Manage Event Roles` is removed.
  - `filters out legacy basic and guest roles from RBAC role dropdowns when creating or editing internal staff`: Proves that `Admin`, `Manager`, and `Staff` appear in internal staff RBAC dropdowns while `Basic User` and `Guest` are excluded.
  - `displays the Manager role (hierarchy: 70) and hierarchy badges in AccessControlPanel`: Verifies that `Manager` appears in default roles and displays its `Hierarchy: 70` and `Internal Staff Role` badges.
- **Vitest Regression Suite:** All 7 existing tests in `UserManagement.test.tsx`, `AccessControlPanel.test.tsx`, and `rbacAdminFlow.test.ts` pass cleanly alongside the 3 new tests (10 total tests passing).
- **Full CI:** Passed `npm run typecheck`, `npm run lint:events`, unused locals validation, and single-file production bundle build (`npm run build`).
