# Review #163 — Venue Portal (`#/admin`, `#/dashboard`, `#/studio`, `#/venuemap`): Complete Universal Branding Remediation & Home/Landing Page Preview Integration

**Date:** 2026-08-10  
**Author:** jstrick9 (Wedding Venue Product / Full-Stack / UI/UX / Quality Assurance Expert)  
**Status:** Completed & Tested

---

## 1. Executive Summary & Problem Discovery

### The Challenge
1. **Hardcoded Purple & Colorful Gradients Across Admin Sections:**  
   In **Admin & System Settings (`#/admin`)**, several sub-sections had hardcoded colorful gradient hero banners instead of the executive **`<BrandedSectionHeader>`** component:
   - **Couples Portal (`CoupleManagement.tsx`):** Hardcoded bright pink header (`bg-gradient-to-r from-rose-600 to-pink-600`) and rose-colored buttons/links.
   - **Package Management (`PackageManagement.tsx`):** Hardcoded purple gradient header (`bg-gradient-to-r from-[#4A1942] to-purple-600`).
   - **Guest Portal Management (`GuestPortalManagement.tsx`):** Hardcoded indigo/purple gradient header (`bg-gradient-to-r from-indigo-600 to-purple-600`).
   - **Wayfinding & Map Rules (`VenueWayfindingManagement.tsx`):** Hardcoded teal/emerald gradient header (`bg-gradient-to-r from-teal-600 to-emerald-600`) and 6 hardcoded `bg-teal-600` buttons.
2. **Hardcoded Buttons across Asset Editors & Shape Builder:**  
   - In **Venue Management (`VenueManagement.tsx`)**, the **"✏️ Shape Builder"** button (`bg-gradient-to-r from-purple-600 to-pink-600`) and **"🏨 Lodging"** button (`bg-gradient-to-r from-blue-600 to-[#3b1435]`) were hardcoded.
   - In **Shape Builder (`CustomVenueBuilder.tsx`)**, the modal header, section headings (`Builder Mode`, `Starter Templates`, `Precision Controls`, `Point Controls`, `Tips`), and canvas SVG measurement labels (`fill="#4A1942"`) were hardcoded to purple.
   - In **Chair, Linen, Wall, Table, Template, Spacing, Guideline, and Fixture Management**, primary action buttons and accordion section banners used random hardcoded gradients (`from-amber-500 to-orange-500`, `from-pink-500 to-rose-500`, `from-teal-500 to-emerald-500`, etc.).
3. **Branding Preview Scope (`BrandingManagement.tsx`):**  
   The **Live Preview** in **Branding Management** was tied only to a generic text sample or the Design Studio, rather than previewing the **Home / Landing Page / Venue Dashboard (`#/dashboard`)** as the venue admin actually sees their home dashboard and branding across the platform.

---

## 2. Exhaustive Systemic Remediation & UI/UX Elevation

### A. Universal Executive Section Headers (`<BrandedSectionHeader>`)
- Replaced the bright pink header in `CoupleManagement.tsx`, the purple gradient in `PackageManagement.tsx`, the indigo gradient in `GuestPortalManagement.tsx`, and the teal gradient in `VenueWayfindingManagement.tsx` with uniform **`<BrandedSectionHeader>`** inline cards (`border-left: 4px solid config.primaryColor`).

### B. Home / Landing Page / Venue Dashboard Preview (`BrandingManagement.tsx`)
- Upgraded **"👁️ Live Preview"** into an executive **"👁️ Live Home & Landing Page / Venue Dashboard Preview"** card displaying:
  - **Branded Venue Navigation Bar:** Logo, Venue Name, Tagline, and primary navigation pills (`Home / Dashboard`, `Layout Studio`, `Calendar`).
  - **Landing Page Hero Section:** `"Welcome back to {config.venueName}"`, live operational stats (`3 weddings scheduled today • 12 upcoming tours`), and primary action buttons (`"🚀 Launch Studio"`, `"📅 View Calendar"`) styled dynamically with `config.primaryColor`, `config.primaryLight`, and `config.primaryDark`.
  - **Dashboard Today Strip Preview:** Clickable interactive event cards with `WCAG Contrast Verified` badge.
- Upgraded **Live Portal Theme Preview Switcher** tab `'header'` to display `"Home & Landing Page Preview"` instead of `"Admin & Studio"`.

### C. Shape Builder (`CustomVenueBuilder.tsx`) & Venue Management (`VenueManagement.tsx`)
- **`CustomVenueBuilder.tsx`:** Integrated `useBrandingConfig()` and styled the modal header banner with a dynamic linear gradient (`config.primaryColor` and `config.primaryDark`), styled all section headings (`Builder Mode`, `Starter Templates`, `Precision Controls`, `Point Controls`, `Tips`) with `config.primaryColor`, and updated SVG canvas text measurement labels (`fill={config.primaryColor}`).
- **`VenueManagement.tsx`:**  
  - Updated the **"✏️ Shape Builder"** button to use `linear-gradient(135deg, config.primaryColor, config.primaryLight)`.
  - Updated the **"🏨 Lodging"** button to use `linear-gradient(135deg, config.accentColor, config.primaryDark)`.
  - Styled active shape option buttons, border settings boxes, and master venue checkmarks dynamically.

### D. Sub-Section Accordions & Asset Action Buttons across `src/components/admin/`
- **`FixtureManagement.tsx`:** Mapped all three accordion section headers (`Venue Fixtures`, `Lodging/Utilities Fixtures`, `Exterior Fixtures`) to dynamic inline linear gradients and updated the `Draw Custom` button to `.btn-primary`.
- **`ChairManagement.tsx`, `LinenManagement.tsx`, `WallManagement.tsx`, `GuidelineManagement.tsx`, `TableManagement.tsx`, `TemplateManagement.tsx`, `SpacingManagement.tsx`, `VenueWayfindingManagement.tsx`:** Replaced all hardcoded colorful gradient action buttons (`from-amber-500 to-orange-500`, `from-pink-500 to-rose-500`, `from-teal-500 to-emerald-500`, `bg-teal-600`) with `.btn-primary` and explicit inline styles from `config.primaryColor`.
- **`src/index.css`:** Expanded the Universal Branding Override Engine to map all solid backgrounds, border colors, opacity slashes, gradient stops (`to-[#6b2a64]`, `to-purple-`, `to-[#6B2C5F]`, etc.), and card tints across the DOM to `var(--primary-color)` and `var(--primary-dark)`.

---

## 3. Automated Test Coverage & Verification

- **New Automated Test Suite (`src/components/admin/VenuePortal.completeBrandingAudit.test.tsx`):**
  - `renders BrandingManagement with dynamic Upload Logo button styling and Home/Landing Page Venue Preview`: Proves that when `config.primaryColor` is set to `#10b981` ("Emerald Manor"), `Upload Logo` uses `linear-gradient(135deg, rgb(16, 185, 129), rgb(4, 120, 87))` and the **Live Home & Landing Page / Venue Dashboard Preview** renders with branded hero header and today strip.
  - `renders CoupleManagement with consistent BrandedSectionHeader instead of bright pink header`: Proves that the Couples Portal header renders as `<BrandedSectionHeader>` with `border-left` colored `rgb(16, 185, 129)`.
  - `renders VenueManagement with dynamically styled Shape Builder and Lodging buttons`: Proves that **"✏️ Shape Builder"** uses `linear-gradient(135deg, rgb(16, 185, 129), rgb(52, 211, 153))` and **"🏨 Lodging"** uses `linear-gradient(135deg, rgb(5, 150, 105), rgb(4, 120, 87))`.
  - `renders CustomVenueBuilder (Shape Builder) with dynamic branding on header and section titles`: Proves that opening the Shape Builder displays `"Builder Mode"` colored `rgb(16, 185, 129)` and the modal header uses `linear-gradient(135deg, rgb(16, 185, 129), rgb(4, 120, 87))`.
  - `renders PackageManagement, GuestPortalManagement, and VenueWayfindingManagement with consistent BrandedSectionHeader`: Proves that all three tabs render `<BrandedSectionHeader>` with border accent colored `rgb(16, 185, 129)`.
- **Vitest Regression Suite:** All 6 test suites across `UserManagement`, `AccessControlPanel`, `rbacAdminFlow`, `UserManagement.internalStaffRbac`, `VenuePortal.universalBranding`, and `VenuePortal.completeBrandingAudit` (25 total tests) pass cleanly.
- **Full CI:** Passed `npm run typecheck`, `npm run lint:events`, unused locals validation, and single-file production bundle build (`npm run build`).
