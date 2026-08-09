# Review #149 — Venue Portal Universal Branding Theme Engine, WCAG AA Contrast Checker, and Live Portal Theme Preview Switcher

**Date:** 2026-08-08  
**Author:** jstrick9 (Venue-Admin Product / Full-Stack / UX / QA Expert)  
**Status:** Completed & Tested

---

## 1. Summary & Goals

This review systematically investigated and fixed the venue-portal branding consistency issue reported where some objects, widgets, buttons, and sidebar items did not change when system branding was modified in **Admin & System Settings > System Brand & Access > Branding**.

Acting as a full-stack developer, QA, and product/UX expert, we designed a two-pronged **Universal Branding Theme Engine** combining live React state subscriptions (`useBrandingConfig()`) and comprehensive CSS utility mappings (`src/index.css`), ensuring every single UI component across the entire Venue Portal updates dynamically and instantly. Furthermore, we enhanced the Branding editor (`BrandingManagement.tsx`) with an automated **✨ WCAG AA Contrast & Accessibility Checker** and a **🎨 Live Portal Theme Preview Switcher**.

---

## 2. Root Cause Analysis & Universal Branding Theme Engine Fix

### A. Why Some Objects Previously Failed to Change When Branding Was Updated
- **Root Cause**:
  1. **Static React Configuration Loading**: Across major portal components (`AuthenticatedApp`, `VenueDashboard`, `Header`, `Sidebar`, `AdminPanel`, `StaffOperationsPanel`, `VenueChatPanel`, `CouplesPortal`, `GuestPortal`), branding configuration was loaded once on mount via static `getConfig()` or `useState(() => getConfig())` calls. When an administrator updated branding colors or fonts in `BrandingManagement.tsx`, `localStorage[STORAGE_KEYS.CONFIG]` was saved, but surrounding components never re-rendered until a full browser reload.
  2. **Incomplete CSS Class Overrides**: In `src/index.css`, CSS override rules mapped `#4A1942` hex selectors, but omitted standard Tailwind purple/primary utility classes (`bg-purple-600/700`, `text-purple-700/900`, `border-purple-300/400`, `ring-purple-200/300`, `hover:bg-purple-700/800`, `from-purple-700`, etc.) used across more than 527 component occurrences.

### B. Two-Pronged Universal Branding Fix
1. **Live React State Subscription Hook (`useBrandingConfig()`)**:
   - Created and exported `useBrandingConfig(): Config` in `src/config.ts`.
   - Subscribes to `'spm_data_changed'` and window `'storage'` events, automatically calling `applyRootStyles(next)` and updating React state whenever branding changes.
   - Replaced static `getConfig()` calls across all 10 major portal surfaces: `AuthenticatedApp.tsx`, `VenueDashboard.tsx`, `Header.tsx`, `Sidebar.tsx`, `AdminPanel.tsx`, `StaffOperationsPanel.tsx`, `VenueChatPanel.tsx`, `VenueCalendar.tsx`, `CouplesPortal.tsx`, and `GuestPortal.tsx`.
2. **Universal CSS Theme Mapping Engine (`src/index.css`)**:
   - Built 14 comprehensive CSS override rules mapping every solid background, solid text, hover background/text, border, ring, focus ring, form input accent, gradient stop, SVG fill/stroke, and translucent tint to `var(--primary-color)`, `var(--primary-dark)`, and `var(--primary-light)`.
   - All translucent badges, soft backgrounds, and rings dynamically compute `color-mix(in srgb, var(--primary-color) X%, transparent)`, so custom brand themes (Deep Plum, Navy & Gold, Emerald Green, Burgundy, Obsidian) retain correct alpha transparency.

---

## 3. UI/UX Enhancements in `BrandingManagement.tsx`

### A. ✨ WCAG AA Text Contrast & Accessibility Checker
- Implemented relative luminance and contrast ratio calculations (`getLuminance`, `getContrastRatio` in `src/utils/color.ts`).
- Above the Live Preview, added an automated accessibility banner:
  - **Passes Contrast**: When the contrast ratio between `config.primaryColor` and white text (`#FFFFFF`) is >= 4.5:1, displays a green **`✅ WCAG AA Text Contrast: X:1 — Passes Accessibility Guidelines`** badge.
  - **Low Contrast Warning**: When a low-contrast primary color is chosen (e.g. pale pink or pastel yellow), displays an amber warning badge with a 1-click **`✨ Auto-Fix Contrast`** button that darkens the color to meet WCAG AA compliance.

### B. 🎨 Live Portal Theme Preview Switcher
- Replaced the static preview box with an interactive 3-tab portal theme previewer:
  1. **`Header Banner` Tab**: Previews the header gradient with Primary CTA (`config.accentColor`), Secondary CTA, and link accent styling.
  2. **`Dashboard KPI` Tab**: Previews a Venue Dashboard KPI card and badge styling with the configured primary/accent colors and background color.
  3. **`Portal Chat` Tab**: Previews a Couples Portal Chat message bubble and coordinator badge styling with the configured primary color.

---

## 4. Test Suite & CI Verification

### New Automated Unit Test Suite
- **`src/components/admin/BrandingManagement.test.tsx` (4 tests)**:
  1. `renders Quick Presets, color pickers, WCAG contrast badge, and Portal Theme preview tabs` — Verifies preset buttons, color pickers, and accessibility badge rendering.
  2. `switches between Header Banner, Dashboard KPI, and Portal Chat preview tabs` — Verifies clicking preview tabs displays correct interactive preview cards.
  3. `displays WCAG AA pass badge for high-contrast primary colors (#4A1942)` — Verifies high-contrast brand colors pass accessibility checks without warnings.
  4. `displays Low Contrast Warning and Auto-Fix button for low-contrast primary colors` — Verifies low-contrast colors trigger WCAG warnings and render the Auto-Fix button.

### Verification Results
- **TypeCheck**: Clean (`npm run typecheck`).
- **Event Bus Lint**: Clean (`npm run lint:events` — zero raw `spm_*` strings outside typed bus).
- **Unused Locals Check**: Clean (`npx tsc --noEmit --noUnusedLocals`).
- **Full Vitest Test Suite**: **659 passing / 11 skipped (670 total tests)** across **152 test files** (`npx vitest run`).
- **Single-File Bundle Build**: `npm run build` green (`dist/index.html` ~1,718.79 kB / gzip ~394.30 kB).
