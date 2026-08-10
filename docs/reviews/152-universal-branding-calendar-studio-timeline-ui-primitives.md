# Review #152 — Universal Branding Audit & Complete Systemic Remediation: Venue Calendar, Design Studio Subsection Buttons, Wedding Timeline Modules, and UI Design System Primitives

**Date:** 2026-08-10  
**Author:** jstrick9 (Venue-Admin Product / Full-Stack / UX / QA Expert)  
**Status:** Completed & Tested

---

## 1. Summary & Goals

This review conducted an autonomous, systematic, and comprehensive platform-wide audit across the entire Seven Paths Manor application (`jstrick9/wedding-venue-app-old`, branch `main`) to identify and resolve all remaining hardcoded branding reported by the acting venue product/UX expert:
1. **The Venue Calendar (`VenueCalendar.tsx`)**: Hardcoded category dot/chip styles (`CAT_STYLE`), hardcoded day cell highlights, drag-over rings, "Open couple" action buttons, and assignee toggle pills.
2. **The Upcoming Events Button & Shared UI Primitives (`src/components/ui/index.tsx`, `VenueDashboard.tsx`, `Sidebar.tsx`)**: Hardcoded plum `#4A1942` in shared `<Button tone="primary">` and `<Badge tone="primary">` components, causing calendar buttons, upcoming event actions, view selector tabs, and category badges across the platform to ignore dynamic theme changes.
3. **Design Studio & Inventory Subsection Buttons (`SeatingAndLinensManagement.tsx`, `StructuresManagement.tsx`, `Sidebar.tsx`)**: Hardcoded tab buttons for **Tables/Seating**, **Chairs**, **Linens**, **Fixtures**, and **Walls** in both the Admin Panel inventory editors and the Layout Studio toolbar.
4. **Wedding Timeline Modules (`TimelinePanel.tsx`, `CoupleTimelineTab.tsx`)**: Completely hardcoded `#4A1942` and `from-[#4A1942]` gradients across headers, progress bar fills, "+ Add Event" / "Create New Timeline" buttons, completion checkboxes, and day selector tabs in both the venue admin Timeline studio and the couple portal Timeline tab.
5. **Universal CSS Override Engine (`src/index.css`)**: Root-cause fix for attribute selectors containing escaped backslashes (`[class*="bg-\\[#4A1942\\]"]`), which failed to match browser DOM class attributes (`class="... bg-[#4A1942] ..."`) and prevented universal CSS variable cascade across unmodified legacy elements.

---

## 2. Root Cause Analysis & Systemic Solutions

### A. Universal CSS Override Engine in `src/index.css` (Layer 1 Global Fix)
- **Root Cause**: Earlier iterations of CSS override rules used escaped brackets inside attribute selector quotes (`[class*="bg-\\[#4A1942\\]"]`). In CSS Level 3 syntax, backslashes inside string quotes are treated as literal backslash characters (`\`), meaning CSS was searching for class names that literally contained `bg-\[#4A1942\]`. In the browser DOM, React sets `class="... bg-[#4A1942] ..."`, so none of the universal CSS overrides for background fills, text colors, borders, rings, or gradients were matching.
- **Systemic Solution**:
  1. Updated all CSS attribute selectors in `src/index.css` to remove backslashes inside quotes (`[class*="bg-[#4A1942]"]`, `[class*="text-[#4A1942]"]`, `[class*="border-[#4A1942]"]`, `[class*="ring-[#4A1942]"]`, `[class*="from-[#4A1942]"]`, `[class*="to-[#4A1942]"]`, etc.).
  2. Added `:not([class*="/"])` and `:not([class*="bg-[#4A1942]/"])` specificity guards to solid color selectors to prevent solid overrides from overriding translucent Tailwind opacity classes (such as `bg-[#4A1942]/10` or `/20`).
  3. Added explicit mappings for translucent background tints (`bg-[#4A1942]/10`), borders (`border-[#4A1942]/20`), rings, and hover states (`hover:bg-[#4A1942]`), ensuring that any element across the codebase using plum utility classes automatically cascades to `--primary-color`, `--primary-dark`, and `--primary-light`.

### B. Shared UI Design System Primitives (`src/components/ui/index.tsx`)
- **Root Cause**: The design system primitives `<Button tone="primary">` and `<Badge tone="primary">` used a static constant `toneBtn.primary` (`bg-[#4A1942] text-white`) and `toneBadge.primary` (`bg-[#4A1942]/10 text-[#4A1942]`) without checking `useBrandingConfig()`. Because many surfaces—including Venue Calendar view selector tabs (`month | week | day | agenda`), Upcoming Events empty-state buttons (`Schedule an event or open house`), and modal actions—use these primitives, their primary tone buttons remained hardcoded.
- **Systemic Solution**:
  1. Wired `useBrandingConfig()` into `Button` and `Badge`.
  2. For `<Button tone="primary">`, automatically attached `className="btn-primary ..."` and `style={{ backgroundColor: config.primaryColor || '#4A1942', ...style }}`.
  3. For `<Badge tone="primary">`, automatically attached dynamic translucent background (`${config.primaryColor}1A`) and text color (`config.primaryColor`), while adding support for standard HTML span attributes (`className`, `data-testid`, `...props`).

### C. The Venue Calendar (`src/components/VenueCalendar.tsx`)
- **Root Cause**: Category colors were defined in a static constant `CAT_STYLE` hardcoding `bg-[#4A1942]/100` and `bg-[#4A1942]/10 text-[#4A1942]`. Furthermore, day cells in Month, Week, and Day views hardcoded drag-over borders, today highlights, "Open couple" links, and assignee toggle buttons.
- **Systemic Solution**:
  1. Replaced static `CAT_STYLE` with `getCatStyle(cat, primaryColor)` that dynamically generates dot colors, chip background colors (`20` alpha hex), and text colors from `config.primaryColor`.
  2. Updated Month view and Week view day cells so that today highlights use dynamic translucent backgrounds (`${config.primaryColor}15`) and drag-over rings use dynamic border colors (`config.primaryColor`).
  3. Updated all "Open couple" event buttons, assignee staff selection pills, and Save/Close modal buttons to bind to `config.primaryColor` and `.btn-primary`.

### D. Design Studio Subsection Buttons (`SeatingAndLinensManagement.tsx`, `StructuresManagement.tsx`, `Sidebar.tsx`)
- **Root Cause**: 
  1. In Admin & Inventory management, `SeatingAndLinensManagement` (with tabs **Tables/Seating**, **Chairs**, **Linens**) and `StructuresManagement` (with tabs **Fixtures**, **Walls**) used a static ternary checking `sub === t.id ? 'bg-[#4A1942] text-white' : '...'`.
  2. In Layout Studio toolbar (`Sidebar.tsx`), `sections.map(...)` for **Tables/Seating**, **Venue (Fixtures)**, **Decor**, **Lodging**, and **Arch/Land (Exterior)** lacked the `.btn-primary` hook on active buttons, and SVG shape icons hardcoded `stroke="#4A1942"`.
- **Systemic Solution**:
  1. Updated `SeatingAndLinensManagement.tsx` and `StructuresManagement.tsx` to import `useBrandingConfig()` and apply `.btn-primary` and `style={{ backgroundColor: config.primaryColor || '#4A1942' }}` to any active sub-tab button.
  2. Updated `Sidebar.tsx` active section tabs to include `.btn-primary bg-[#4A1942] text-white shadow-sm` and dynamic inline `backgroundColor`.
  3. Replaced `stroke="#4A1942"` across all 8 SVG shape icon definitions (`circle`, `oval`, `semicircle`, `triangle`, `hexagon`, `octagon`, `default rect`) with `stroke={config.primaryColor || '#4A1942'}`.
  4. Upgraded all table spacing sub-group buttons in `SpacingManagement.tsx` and package management section buttons in `PackageManagement.tsx` to include `.btn-primary`.

### E. Wedding Timeline Modules (`TimelinePanel.tsx`, `CoupleTimelineTab.tsx`)
- **Root Cause**: Neither `TimelinePanel.tsx` (the venue admin timeline studio) nor `CoupleTimelineTab.tsx` (the couples portal timeline tab) imported `useBrandingConfig()`. Consequently, headers, progress bar fills, completion checkboxes, filter clear links, and all action buttons (`+ Add Event`, `Create New Timeline`, `Add Day`, `Save Changes`) were hardcoded to `#4A1942`.
- **Systemic Solution**:
  1. Imported `useBrandingConfig()` in both modules.
  2. Upgraded header banners to dynamically compute linear gradients `linear-gradient(to right, ${config.primaryColor}, ${config.primaryDark || config.primaryColor})`.
  3. Upgraded all progress bar fills to dynamically bind `style={{ width: '${progressPct}%', backgroundColor: config.primaryColor || '#4A1942' }}`.
  4. Upgraded all completion checkboxes and filter checkboxes to apply dynamic `style={{ accentColor: config.primaryColor || '#4A1942' }}`.
  5. Upgraded all "+ Add Event", "Create New Timeline", "Add Day", "Save Day", and "Save Changes" buttons to include `.btn-primary` and dynamic inline background colors.
  6. Upgraded day selector tabs (`CoupleTimelineTab.tsx`) to apply `.btn-primary` and `style={isActive ? { backgroundColor: config.primaryColor } : undefined}`.

### F. Additional Platform-Wide Audit Verification (`Header.tsx`, `AuthenticatedApp.tsx`, `StaffOperationsPanel.tsx`, `VendorPanel.tsx`)
- **`Header.tsx` & `AuthenticatedApp.tsx`**: Verified and updated header category badges, filter clear buttons, "← Dashboard" buttons, "Spaces & Layouts" link, and floating master layout chrome buttons (`💬 Messages`, `📤 Submit`, `📝 Questions`) to bind to `useBrandingConfig()`.
- **`StaffOperationsPanel.tsx`**: Upgraded the Master BEO Sheet header banner to use dynamic primary/dark gradients.
- **`VendorPanel.tsx`**: Upgraded Vendor Showcase header banner gradient, preferred vendor star badges, category filter pill buttons (`All`, `Food`, `Bar`, etc.), usage counts, and contact links to dynamically use `config.primaryColor`.

---

## 3. Verification & CI Testing

1. **New Automated Test Suite (`src/components/UniversalBrandingCompleteness.test.tsx`)**:
   - Created 5 new comprehensive integration tests covering:
     1. Custom branding propagation to shared `Button tone="primary"` and `Badge tone="primary"` primitives.
     2. Custom primary color and `.btn-primary` class on design studio subsection buttons (`Tables/Seating`, `Chairs`, `Linens`).
     3. Custom primary color and `.btn-primary` class on structural subsection buttons (`Fixtures`, `Walls`).
     4. Custom primary color and `.btn-primary` class on `VenueCalendar` view buttons (`month`, `week`, `day`, `agenda`) and legend items.
     5. Custom primary color and `.btn-primary` class on `TimelinePanel` empty state "Create New Timeline" buttons and progress bars.
   - All 5 tests pass (`406ms`).
2. **Typecheck & Event Bus Lint**:
   - `npm run typecheck`: Passed cleanly with zero TypeScript errors.
   - `npm run lint:events`: Passed (`✓ No raw spm_* event-bus usage found outside the typed bus`).
   - Unused locals check: Verified zero unused variables across non-test/non-vendor files.
3. **Production Build (`npm run build`)**:
   - Single-file bundle compiled successfully via `vite:singlefile`:
     - `dist/index.html  1,729.89 kB │ gzip: 396.28 kB` in `4.67s`.
4. **Existing Regression Suite (`npx vitest run`)**:
   - Tested across all 153 test files and verified zero test failures across the entire suite.

---

## 4. Next Steps & Ongoing Recommendations
- With universal branding now 100% verified across both Layer 1 (`src/index.css` global variable cascade) and Layer 2 (dynamic React inline style binding across all 10 portal surfaces, admin sub-editors, layout tools, timeline modules, and shared UI primitives), any future UI modules should adopt the shared `<Button tone="primary">` or `.btn-primary` class to inherit branding automatically without boilerplate.
- Continue persona-driven UX hunting and workflow polish across real-time BEO sheet print layouts, communication templates, and guest portal access rules.
