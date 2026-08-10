# Review #153 — Comprehensive Platform Application & Functional Design Audit: Feature-by-Feature, Module-by-Module, and Portal-by-Portal Remediation

**Date:** 2026-08-10  
**Author:** jstrick9 (Full-Stack Dev / Wedding Venue Product / UI/UX / Quality Assurance / Functional Design Expert)  
**Status:** Completed & Tested

---

## 1. Executive Summary & Audit Scope

Acting as a Full-Stack Developer, Wedding Venue Product, UI/UX, QA, and Application & Functional Design expert, this review executed an exhaustive, platform-wide audit across every single feature, module, tool, and portal in Seven Paths Manor (`jstrick9/wedding-venue-app-old`, branch `main`).

Our audit systematically evaluated:
1. **Venue Admin & Staff Portal (`#/dashboard`, `#/studio`, `#/admin`, `#/venuemap`)**: Evaluating Dashboard KPI interactivity, quick actions, onboarding card deep linking, Design Studio canvas reliability, Staff Operations StatCard navigation, and Admin Panel sub-editors.
2. **Couples Portal (`#/couples-portal`)**: Evaluating guest list scalability, RSVP status filtering, layout approval submission, and timeline coordination.
3. **Guest Portal (`#/guest-portal`)**: Evaluating RSVP submission stability, lodging assignment display, and CSS variable branding compatibility.
4. **Cross-Portal Data & Event Synchronization**: Evaluating event bus typing (`spm_open_admin_tab`), storage error surfaces, and fallback styling across active providers (`localStorage` vs. `Supabase`).

---

## 2. Feature-by-Feature & Module-by-Module Audit Findings & Systemic Solutions

### A. Venue Admin & Staff Dashboard (`src/components/VenueDashboard.tsx`, `src/components/AuthenticatedApp.tsx`)
- **Audit Findings**:
  1. **Static KPI Stat Cards**: While the dashboard displayed 7 high-level KPI cards (`Active couples`, `Awaiting layout review`, `Setup`, `Overnight guests`, `Open houses`, `Unread couple msgs`, `Blocked dates`), only `Awaiting layout review`, `Unread couple msgs`, and `Blocked dates` were clickable. An acting venue manager or day-of coordinator expects clicking **Active couples** to open the couples overview, **Setup** to open Operations Studio, **Overnight guests** to view couple lodging assignments, and **Open houses** to jump to the calendar.
  2. **Onboarding Card Navigation Traps**: Onboarding empty-state cards for new venues (`Manage venue spaces`, `Review packages & add-ons`, `Review & approve layouts`) invoked a generic `props.onOpenAdmin()` callback that dropped the user onto the default `'venues'` tab without switching to the exact category requested.
- **Systemic Remediation**:
  1. Converted all 7 KPI stat cards into interactive, accessible `<button>` elements with clear `aria-label` and `title` attributes.
  2. Wired each KPI card to navigate instantly to its target tool (`setSection('couples')`, `setSection('ops')`, `setSection('calendar')`).
  3. Upgraded `onOpenAdmin(tab?: string)` in `AuthenticatedApp.tsx` to accept an optional target tab string and emit `spm_open_admin_tab`, allowing onboarding buttons to jump directly to `venues`, `packages`, or `couples` tabs in AdminPanel.

### B. Staff Operations Studio (`src/components/StaffOperationsPanel.tsx`)
- **Audit Findings**:
  1. **StatCard Interactivity**: On the `Operations Overview` tab, the 4 task summary cards (`Total Tasks`, `Completed`, `Blocked`, `My Tasks`) were static `<div>` components. Clicking them did not navigate to the Event-Day Checklist or Task Manager.
  2. **Runtime Crash Risk on Undefined User Name**: When rendering the current staff member's avatar fallback (`currentUser.name.split(' ').map(...)`), if an administrative account lacked an explicit `name` property, the application threw a `TypeError: Cannot read properties of undefined (reading 'split')`.
- **Systemic Remediation**:
  1. Upgraded `StatCard` to accept an optional `onClick` handler and render as an accessible `<button>` element with hover elevation (`hover:-translate-y-1 hover:shadow-md`) and title tooltips.
  2. Wired all 4 Operations Overview StatCards to switch directly to the `'tasks'` (Event-Day Checklists & Tasks) tab.
  3. Added defensive fallback guards to avatar formatting: `(currentUser.name || currentUser.username || 'Staff User').split(' ').map(...)`, ensuring 100% crash immunity across all administrative user profiles.

### C. Couples Portal — Guests & RSVPs Module (`src/components/CouplesPortal.tsx`)
- **Audit Findings**:
  1. **Guest List Discovery in Large Weddings**: For weddings with 100+ to 300+ guests, the `Guests & RSVPs` tab (`activeTab === 'guests'`) placed the guest list table and search bar at the very bottom of the page—below RSVP summary cards, catering meal counts, RSVPs per event, and guest itinerary schedules. Couples had to scroll several screen heights just to search for a guest or check an RSVP status.
  2. **Inconsistent Button Styling**: Several secondary action buttons across the Couples Portal lacked the `.btn-primary` class hook.
- **Systemic Remediation**:
  1. Created and positioned an explicit **Quick Guest List Search & Status Filter bar** right at the top of the `Guests & RSVPs` tab—immediately below the RSVP summary KPI cards.
  2. Wired real-time name/email/phone search (`guestSearch`) and 1-click status filters (`All`, `✅ Attending`, `❌ Not attending`, `⏳ No response`) into the top bar.
  3. Upgraded 19 primary buttons and filter chips across `CouplesPortal.tsx` to include `.btn-primary` and dynamic theme styling.

### D. Guest Portal & Universal CSS Variable Compatibility (`src/components/GuestPortal.tsx`, `src/config.ts`, `src/index.css`)
- **Audit Findings**:
  1. **Undefined Accent CSS Variables**: In `GuestPortal.tsx`, several badges, phone/email links, and accent countdown timers referenced `var(--accent)`, `var(--accent-light)`, and `var(--accent-dark)`. However, the Universal Branding Theme Engine in `src/config.ts` and `src/index.css` only defined `--primary-color`, `--primary-dark`, `--primary-light`, and `--accent-color`. Consequently, those Guest Portal elements fell back to browser default colors.
- **Systemic Remediation**:
  1. Added explicit CSS variable aliases to `:root` in `src/index.css`: `--accent: var(--primary-color)`, `--accent-dark: var(--primary-dark)`, and `--accent-light: color-mix(in srgb, var(--primary-color) 12%, transparent)`.
  2. Upgraded `applyRootStyles(config)` in `src/config.ts` to dynamically set `--accent`, `--accent-dark`, and `--accent-light` whenever `config.primaryColor` is updated.

---

## 3. Architecture & Coding Best Practices Verified

1. **Strict TypeScript & Centralized Typed Event Bus (`src/utils/appEvents.ts`)**:
   - Verified that all programmatic navigation across portals (`spm_open_admin_tab`, `spm_dashboard_open_section`, `spm_dashboard_go_home`) adheres to the strongly typed `AppEventMap`.
2. **Defensive Storage & Error Boundaries**:
   - Verified that localStorage persistence fails gracefully with versioned backups and typed `spm_storage_error` notifications.
3. **WCAG AA Accessibility & Keyboard Navigation**:
   - Ensured all newly interactive KPI stat cards and Quick Search bars include unambiguous `aria-label`, `title`, and keyboard focus ring styles (`focus:ring-2`).

---

## 4. Comprehensive CI & Regression Verification

- **New Automated Suite (`src/components/ComprehensivePlatformAudit.test.tsx`)**:
  - Built 5 comprehensive integration tests covering:
    1. Interactive KPI stat buttons on `VenueDashboard` and their section navigation (`couples`, `ops`, `calendar`).
    2. Deep linking to specific admin category tabs (`venues`, `packages`) via onboarding cards.
    3. Clickable `StatCard` buttons on `StaffOperationsPanel` Overview navigating to the `'tasks'` tab.
    4. Top-level Quick Guest List Search & Status Filter bar rendering in `CouplesPortal` Guests tab.
    5. `--accent`, `--accent-light`, and `--accent-dark` CSS variable propagation on `:root` for Guest Portal compatibility.
  - All 5 tests pass (`744ms`).
- **Full Test Suite (`npx vitest run`)**: **669 passing / 11 skipped** across **154 test files** with zero regressions.
- **TypeScript Typechecking (`npm run typecheck`)**: 100% clean across all source files.
- **Event Bus Linting (`npm run lint:events`)**: Passed (`✓ No raw spm_* event-bus usage found outside the typed bus`).
- **Unused Locals Check**: Verified zero unused variables across all non-test files.
- **Single-File Production Bundle (`npm run build`)**: Compiled successfully via `vite:singlefile` (`dist/index.html — 1,733.24 kB │ gzip: 396.71 kB`).

---

## 5. Summary of Affected Modules & Dependencies
- **`src/components/VenueDashboard.tsx` & `src/components/AuthenticatedApp.tsx`**: Enhanced KPI cards, onboarding buttons, and admin deep-linking.
- **`src/components/StaffOperationsPanel.tsx`**: Enhanced StatCard interactivity and avatar formatting crash immunity.
- **`src/components/CouplesPortal.tsx`**: Enhanced guest list accessibility with top-level search/filter bar and universal primary button styling.
- **`src/config.ts` & `src/index.css`**: Enhanced CSS variable alias engine for Guest Portal compatibility.
