# 144 — Venue Portal: Navigation & Dashboard Inline Panels Fix + UI/UX Enhancement Pass

## Overview
As an acting **wedding-venue product, UX, full-stack, and QA expert**, I investigated and resolved the reported bug where closing inline operational panels (**Vendors**, **Timeline**, or **Operations**) on the Venue Dashboard warped the user directly to the Design Studio (`#/studio`) instead of returning to the Dashboard home section (`#/dashboard`). 

In addition, I conducted an autonomous, systematic UI/UX enhancement hunt across the entire Venue Portal to fix navigation traps, improve accessibility and search, and streamline daily operational workflows for venue admins.

## Bugs & UX Gaps Identified & Resolved
1. **Inline Dashboard Panel Exit Bug (`VenueDashboard.tsx`, `AuthenticatedApp.tsx`)**:
   - *Reported Issue*: Clicking into **Vendors** from the Venue Dashboard and clicking Close/Exit took the user directly to the Design Studio (`#/studio`, `view === 'studio'`).
   - *Root Cause*: `AuthenticatedApp.tsx` passed `onClose={() => setView('studio')}` for `vendorsNode`, `opsNode`, and `timelineNode`, and passed `setView('studio'); open('vendors')` for quick actions.
   - *Resolution*:
     - Wired `onClose` on `vendorsNode`, `opsNode`, and `timelineNode` to set hash `'#/dashboard'`, view `'dashboard'`, and emit `'spm_dashboard_go_home'`.
     - Wired `onOpenVendors`, `onOpenOperations`, and `onOpenTimeline` to emit `'spm_dashboard_open_section'` so they open cleanly inside `VenueDashboard.tsx`.
     - Added event listeners in `VenueDashboard.tsx` for `spm_dashboard_go_home` (returns to `'home'` section) and `spm_dashboard_open_section` (switches to `'vendors'`, `'ops'`, or `'timeline'` section).

2. **Dashboard Quick Actions Completeness (`VenueDashboard.tsx`)**:
   - *Issue*: The Quick actions card on the Dashboard Home page was missing one-click shortcuts to **Vendor Showcase** and **Timeline Studio**.
   - *Resolution*: Added **Vendor Showcase** (`setSection('vendors')`) and **Timeline Studio** (`setSection('timeline')`) buttons to Quick actions.

3. **Live Unread Couple Messages Alert Banner (`VenueDashboard.tsx`)**:
   - *Enhancement*: When `stats.unread > 0`, the Dashboard Home page now displays a prominent **"💬 New Messages from Couples"** alert banner right above the KPI strip, with a one-click **"View Couples & Reply →"** button (`setSection('couples')`). The `"Unread couple msgs"` KPI card itself is also now an interactive button.

4. **Dashboard Onboarding Category Links (`VenueDashboard.tsx`, `AdminPanel.tsx`)**:
   - *Enhancement*: Clicking **"Add your venue spaces"** or **"Review packages & add-ons"** on the first-time onboarding card now emits `'spm_open_admin_tab'`, opening `AdminPanel.tsx` directly to the `venues` or `packages` category tab.
   - Added an explicit **"← Dashboard"** button next to the close `✕` icon in `AdminPanel.tsx`'s top header.

5. **Top Header Menu Filtering (`Header.tsx`)**:
   - *Enhancement*: Studio-specific canvas commands (`Save Layout`, `Load Layout`, `Save as Master Layout`, `Clear Master Layout`, `Templates`) are now hidden from `Header.tsx`'s `☰ Menu` dropdown when viewing the Dashboard (`#/dashboard`) or Admin (`#/admin`), removing irrelevant canvas actions from non-studio pages.

6. **Instant Template Search in Design Studio (`StudioLayoutsHome.tsx`)**:
   - *Enhancement*: Added a real-time text search filter (`templateSearch`) to `StudioLayoutsHome.tsx` right above the template gallery cards, allowing venue admins to search templates by name or description instantly.

## Automated Tests Added
- `src/components/AuthenticatedApp.dashboardNav.test.tsx` (4 tests):
  - `keeps user on #dashboard when clicking Vendors and closing Vendors returns to dashboard home`
  - `keeps user on #dashboard when clicking Timeline Studio and closing returns to dashboard home`
  - `hides studio-specific menu items (Save Layout, Load Layout, Templates) from Header menu when on dashboard`
- `src/components/VenueDashboard.test.tsx` (3 new tests, 10 total):
  - `switches to vendors section and returns to home section when spm_dashboard_go_home is dispatched`
  - `switches to ops or timeline section when spm_dashboard_open_section is dispatched`
  - `renders Unread Couple Messages alert banner and allows clicking KPI card to switch to couples section`
- `src/components/StudioLayoutsHome.test.tsx` (1 new test, 7 total):
  - `filters templates by search text matching name or description`

## CI & Verification
- Full test suite: **632 passing / 11 skipped** across 144 test files (`npx vitest run`).
- Clean TypeScript check (`npm run typecheck`), clean event-bus lint (`npm run lint:events`), clean unused-locals check, and green production single-file build (`npm run build`).
