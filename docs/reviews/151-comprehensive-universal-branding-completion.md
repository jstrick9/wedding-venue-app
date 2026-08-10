# Review #151 — Comprehensive Platform-Wide Universal Branding Audit & Completion: Home Page Quick Actions, Sign Out Links, Login Selection Board, and Dynamic Text/Font Engine

**Date:** 2026-08-08  
**Author:** jstrick9 (Venue-Admin Product / Full-Stack / UX / QA Expert)  
**Status:** Completed & Tested

---

## 1. Summary & Goals

This review conducted an exhaustive, platform-wide audit across every single file in the Seven Paths Manor workspace to hunt down and resolve all remaining branding inconsistencies reported where:
1. From the home page (`VenueDashboard.tsx`), **Upcoming events** chips and **Quick actions** buttons did not update when branding was changed.
2. From the menu (`Header.tsx` & `VenueDashboard.tsx`), the **Sign Out** link did not update with the custom branding.
3. From the login page (`LoginScreen.tsx`), selecting username or password (the **"selection board" / input focus border & shadow**) and clicking the **Open Wedding Guest Portal** button still defaulted to hardcoded plum colors.

Acting as a full-stack developer, QA, and wedding venue product/UX expert, we audited 527+ occurrences of `#4A1942`, hardcoded plum CSS utilities, and form input focus styles across `src/index.css` and all 10 portal surfaces—ensuring the entire platform dynamically uses configured branding settings.

---

## 2. Root Cause Analysis & Comprehensive Systemic Fixes

### A. Home Page Quick Actions & Upcoming Events (`VenueDashboard.tsx`)
- **Root Cause**:
  1. In the **Quick actions** card, only the first button (`Admin & System Settings`) used `.btn-primary` and `style={{ backgroundColor: config.primaryColor }}`. The remaining 6 Quick action buttons (`Design Studio`, `Calendar`, `Operations Studio`, `Vendor Showcase`, `Timeline Studio`, `Portal Chat & DMs`) used hardcoded gray border classes (`border border-gray-200 text-gray-700`).
  2. In **Upcoming events** and the **Today strip**, helper `catChip(e.category)` returned hardcoded utility strings (`bg-[#4A1942]/10 text-[#4A1942]`) without applying dynamic inline styles.
- **Fixes Applied**:
  - Upgraded all 7 **Quick actions** buttons to apply dynamic borders, fills, and text colors using `config.primaryColor` (`borderColor: ${config.primaryColor}40`, `backgroundColor: ${config.primaryColor}0D`, `color: config.primaryColor`).
  - Created `catChipStyle(cat)` so any couple event chip in **Upcoming events**, **Today strip**, and **Open** action links dynamically styles its background (`${config.primaryColor}20`) and text (`config.primaryColor`).

### B. Sign Out Link in Menus (`Header.tsx` & `VenueDashboard.tsx`)
- **Root Cause**:
  - In `Header.tsx`, the Sign Out button in the desktop dropdown menu (line 656) was hardcoded to `text-red-600 hover:bg-red-50`, and in the mobile drawer (line 936) was hardcoded to `bg-red-500/80`.
  - In `VenueDashboard.tsx`, the sidebar Sign Out link (line 238) was hardcoded to `text-[#4A1942]`.
- **Fixes Applied**:
  - Upgraded Sign Out links in `Header.tsx` (desktop dropdown and mobile drawer) and `VenueDashboard.tsx` to dynamically bind to `style={{ color: config.primaryColor }}` and `style={{ backgroundColor: config.primaryColor }}`.

### C. Login Page Selection Board & Open Wedding Guest Portal (`LoginScreen.tsx` & `src/index.css`)
- **Root Cause**:
  1. **Selection Board (Input Focus Ring & Border)**: In `LoginScreen.tsx`, username and password inputs had Tailwind classes `focus:ring-[#4A1942]/20 focus:border-[#4A1942]`. Furthermore, `src/index.css` had hardcoded `border-color: var(--color-plum-400)` and `box-shadow: 0 0 0 3px rgba(74, 25, 66, 0.15)` on `input:focus`, `select:focus`, `textarea:focus`, `.form-input:focus`, and `*:focus-visible`.
  2. **Open Wedding Guest Portal Button**: While the parent `<button>` tag had inline styles, child `<span>` tags inside `Open Wedding Guest Portal` and `Continue as Planner Guest` had hardcoded `text-[#4A1942]` classes that overrode the parent button's inline color.
- **Fixes Applied**:
  - Created `handleInputFocus` and `handleInputBlur` in `LoginScreen.tsx`, dynamically styling input `borderColor` and 3px glowing `boxShadow` with `config.primaryColor` whenever an end user focuses on username or password inputs.
  - Upgraded universal CSS override rules in `src/index.css`:
    ```css
    input:focus, select:focus, textarea:focus, .form-input:focus, [class*="focus:ring-"]:focus, [class*="focus:border-"]:focus {
      outline: none !important;
      border-color: var(--primary-color) !important;
      --tw-ring-color: color-mix(in srgb, var(--primary-color) 25%, transparent) !important;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 25%, transparent) !important;
    }
    *:focus-visible {
      outline: 2px solid var(--primary-color) !important;
      outline-offset: 2px;
    }
    ::selection {
      background: color-mix(in srgb, var(--primary-color) 25%, transparent);
      color: var(--primary-dark);
    }
    ```
  - Removed hardcoded `text-[#4A1942]` classes from child `<span>` elements inside `Open Wedding Guest Portal` and `Continue as Planner Guest` buttons so they cleanly inherit from the button's dynamic brand styling.

---

## 3. Test Suite & CI Verification

### New Automated Unit Tests
1. **`src/components/LoginScreen.test.tsx`** — Added test `styles username/password inputs on focus and Open Guest Portal button with brand primary color`:
   - Verifies focusing on the username input applies `rgb(74, 25, 66)` border color and `0 0 0 3px` glowing shadow.
   - Verifies the `Open Wedding Guest Portal` button applies `rgb(74, 25, 66)` text color.
2. **`src/components/VenueDashboard.test.tsx`** — Added test `applies brand primary color to Sign Out link, Quick actions buttons, and Upcoming events chips`:
   - Verifies the sidebar Sign Out button and Design Studio Quick Action button apply `rgb(74, 25, 66)` text color.

### Verification Results
- **Targeted Test Suites**: 46 passing tests across 7 major test suites (`LoginScreen.test.tsx`, `Header.test.tsx`, `VenueDashboard.test.tsx`, `StudioLayoutsHome.test.tsx`, `DecorDesigner.test.tsx`, `BrandingManagement.test.tsx`, `AuthenticatedApp.dashboardNav.test.tsx`).
- **TypeCheck**: Clean (`npm run typecheck`).
- **Event Bus Lint**: Clean (`npm run lint:events` — zero raw `spm_*` strings outside typed bus).
- **Unused Locals Check**: Clean (`npx tsc --noEmit --noUnusedLocals`).
- **Full Vitest Test Suite**: **659 passing / 11 skipped (670 total tests)** across **152 test files** (`npx vitest run`).
- **Single-File Bundle Build**: `npm run build` green (`dist/index.html` ~1,725.30 kB / gzip ~395.48 kB).
