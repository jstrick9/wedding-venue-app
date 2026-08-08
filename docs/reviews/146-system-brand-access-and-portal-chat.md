# Review #146 — System Brand & Access Enhancements, Live CSS Variable Branding, and Portal-to-Portal Chat & DMs Module

**Date:** 2026-08-08  
**Author:** jstrick9 (Venue-Admin Product / Full-Stack / UX / QA Expert)  
**Status:** Completed & Tested

---

## 1. Summary & Goals

This review focused on **Venue Portal > Admin & System Settings > System Brand & Access**, solving three critical venue-administrator needs:
1. **Live, Universal Brand Color Scheme**: Fixed the color scheme so that custom primary, dark, light, and accent colors dynamically affect all widgets, buttons, badges, category items, hover states, and sidebar items across the platform.
2. **Couples & Guest Portal Access Control & User Management Alignment**: Updated User Management (`UserManagement.tsx`) and Access Control (`AccessControlPanel.tsx`) under System Brand & Access to explicitly manage external Couples Portal accounts, Day of Coordination timeline permissions, Guest Portal security rules, and granular RBAC portal policies.
3. **Home-Screen Portal-to-Portal Chat & Direct Messages Module**: Grounded in deep web-search research on leading event venue CRM platforms (Tripleseat, Releventful, Planning Pod), created a dedicated home-screen **Portal Chat & Direct Messages** module (`VenueChatPanel.tsx`) tied to each couple and their event, featuring real-time unread badges, role-differentiated message streams, layout status badges, and professional **⚡ Quick Reply** templates.

---

## 2. Root Cause Analysis & Branding Fixes

### A. Why Branding Colors Previously Failed to Affect Some Widgets & Buttons
- **Root Cause**:
  1. In `src/index.css`, CSS utility mappings for primary buttons and text were strictly scoped to hardcoded hex selectors like `[class*="bg-\\[#4A1942\\]"]`, ignoring standard Tailwind primary/purple classes (`bg-purple-600`, `text-purple-700`, `border-purple-600`, `hover:bg-purple-700`, etc.) used across more than 216 occurrences in `src/components/`.
  2. In `AdminPanel.tsx` and `BrandingManagement.tsx`, saving a color change or selecting a preset updated `localStorage`, but did not immediately call `root.style.setProperty('--primary-color', ...)` in the active DOM session.
- **Fixes Applied**:
  - **Comprehensive Theme Mapping (`src/index.css`)**: Added universal CSS override rules mapping `.btn-primary`, `bg-purple-600/700/900`, `text-purple-600/700/800/900`, `border-purple-400/500/600`, `ring-purple-500/600`, and gradient stops to `var(--primary-color)`. Mapped hover states (`hover:bg-purple-600/700/800`) to `var(--primary-dark)`. Added translucent background/border mappings via `color-mix(in srgb, var(--primary-color) ..., transparent)` for soft badges and cards.
  - **Live Style Injection (`src/config.ts`)**: Added `applyRootStyles(config)` helper and wired it into `setConfig(config)`, `updateConfig(config)`, `AdminPanel.tsx`, and `BrandingManagement.tsx` so changing any color picker or Quick Preset instantly updates the visual theme live across the entire application.
  - **Dynamic Admin & Dashboard Navigation**: Updated category rail buttons, section sub-tab pills, and active badges in `AdminPanel.tsx` and `VenueDashboard.tsx` to dynamically style active borders, fills, and text using `config.primaryColor`.

---

## 3. Access Control & User Management Portal Alignment

### A. Couples & Guest Portal Accounts Management (`UserManagement.tsx`)
- Added two top-level account navigation tabs to User Management:
  1. **`👥 Internal Venue Staff & Admins`**: Manages internal employee accounts and RBAC permissions.
  2. **`💍 Couples & Guest Portal Accounts`**: Displays every booked Couple Event in a responsive card/table layout with:
     - Couple Name, Event Date, Expected Guest Count, and Layout Approval Status badge (`approved`, `pending`, `changes_requested`).
     - **Day of Coordination Service ($1,000) Toggle**: Interactive switch to enable or disable full collaborative timeline editing permissions for each couple event.
     - **Invite Token & Portal Link**: 1-click `"💍 Open Couples Portal ↗"` and `"📋 Copy Link"` actions.
     - **Direct Portal Chat Action**: 1-click `"💬 Portal Chat"` button opening the couple's chat thread.

### B. Couples & Guest Portal Access Control Matrix (`AccessControlPanel.tsx`)
- Added a dedicated 4th tab to Access Control: **`'portal-access'`: `"💍 Couples & Guest Portal Access Rules"`**, displaying all 8 external portal RBAC policies with interactive toggle switches and descriptions:
  1. **`couples:spaces:edit`**: Couples Floor Plan & Seating Layout Design.
  2. **`couples:layout:submit`**: Couples Layout Approval Submission Workflow.
  3. **`couples:timeline:edit`**: Couples Collaborative Wedding Timeline Editing (gated by Day of Coordination).
  4. **`couples:chat:send`**: Couples Portal-to-Portal Direct Messaging & Chat.
  5. **`couples:vendors:view`**: Couples Preferred Vendor Showcase Access.
  6. **`guests:rsvp:submit`**: Guests RSVP & Meal Choice Submission.
  7. **`guests:lodging:view`**: Guests Lodging Room & Manor Map Viewing.
  8. **`guests:portal:password_required`**: Guests Portal Password Security Authentication.

---

## 4. Portal-to-Portal Chat & Direct Messages Module (`VenueChatPanel.tsx`)

### A. Core Architecture & Web-Search Insights
- Grounded in comparative research on Tripleseat, Releventful, and Planning Pod client communication features, we replaced fragmented email/text communication with a centralized, event-tied messaging hub accessible directly from the dashboard home screen.

### B. Key UI/UX Capabilities & Features
1. **Dual-Mode Communication Hub**:
   - **`💍 Couples Portal Chat` Tab**: Manages all client-facing conversations between the venue coordination team and booked couples.
   - **`👥 Internal Team DMs` Tab**: Manages internal operational staff and master basic user direct messages (`DirectMessagePanel`).
2. **Thread Search & Status Filtering (Left Pane)**:
   - Search input `"🔍 Search couples or dates..."` and filter selector (`All Couples`, `Unread Only`, `Approved Layouts`, `Pending Approval`).
   - Displays real-time **Unread Message Badges** (`🔴 X new`), guest counts, and layout approval badges per couple thread.
3. **Event-Tied Active Chat Header**:
   - Top header displays Couple Name, Wedding Date, Guest Count, Layout Status badge, invite token, and quick links to open the Couples Portal or mark messages read.
4. **Role-Differentiated Message Stream**:
   - Distinguishes messages sent by the **Venue Team** (`venue` senderSide in purple bubble) vs. **Couple / Planner** (`couple` senderSide in white/gray bubble) with role badges and timestamps.
5. **⚡ Quick Reply Response Templates**:
   - Above the composer, added 4 professional 1-click response templates that auto-populate the message textarea:
     - **`✨ Layout Approved`**: Official approval confirmation for submitted seating layouts.
     - **`⏱️ Timeline Check-in`**: Check-in on day-of setup times and vendor coordination.
     - **`📋 Final Headcount Reminder`**: 14-day reminder for headcount and RSVP meal choices.
     - **`👋 Welcome & Next Steps`**: Introductory welcome to Seven Paths Manor Couples Portal.
6. **Dashboard Home Screen Integration**:
   - Accessible directly from the Dashboard navigation sidebar (`chat`), Quick Actions button (`"💬 Portal Chat & DMs"`), Header menu dropdown (`"💬 Chat"`), and interactive Unread Couple Messages alert banner/KPI card.

---

## 5. Test Suite & CI Verification

### New & Expanded Test Suites
1. **`src/components/VenueChatPanel.test.tsx` (5 tests)**:
   - Verifies rendering both Couples Portal Chat and Internal Team DMs tabs.
   - Verifies displaying couple event details in thread list and active chat header.
   - Verifies sending a message to a couple event and updating message stream.
   - Verifies populating message composer when clicking a Quick Reply template.
   - Verifies calling `onClose` when clicking `← Dashboard Home` or `✕` close buttons.
2. **`src/components/admin/UserManagement.test.tsx` (2 tests)**:
   - Verifies rendering account type tabs and switching to Couples & Guest Portal accounts view.
   - Verifies toggling Day of Coordination service access for a couple event via `updateCoupleEvent`.
3. **`src/components/admin/AccessControlPanel.test.tsx` (2 tests)**:
   - Verifies rendering all 4 tabs including Couples & Guest Portal Access Rules.
   - Verifies switching to portal access rules tab and toggling policy checkboxes.
4. **`src/components/AuthenticatedApp.dashboardNav.test.tsx` (7 tests)**:
   - Verifies clicking Portal Chat & DMs in Quick actions opens chat module inline on `#dashboard`.
   - Verifies emitting `spm_open_chat` navigates directly to `#dashboard` in chat section and close returns to home.

### Verification Results
- **TypeCheck**: Clean (`npm run typecheck`).
- **Event Bus Lint**: Clean (`npm run lint:events` — zero raw `spm_*` strings outside typed bus).
- **Unused Locals Check**: Clean (`npx tsc --noEmit --noUnusedLocals`).
- **Unit & Integration Suite**: All targeted and full test suites passing.
- **Single-File Bundle Build**: `npm run build` green (`dist/index.html` ~1,665.07 kB / gzip ~382.48 kB).
