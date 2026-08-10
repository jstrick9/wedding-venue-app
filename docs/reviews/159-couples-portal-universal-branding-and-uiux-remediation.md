# Review #159 — Couples Portal (`#/couples-portal`): Exhaustive Universal Branding Remediation & End-User UI/UX Elevation

**Date:** 2026-08-10  
**Author:** jstrick9 (Wedding Venue Product / Full-Stack / UI/UX / Quality Assurance Expert)  
**Status:** Completed & Tested

---

## 1. Executive Summary & Problem Discovery

### The Challenge
While the Couples Portal had been expanded into a high-density executive layout (`max-w-7xl`), an audit revealed over 130 occurrences of hardcoded color classes (`#4A1942`, `purple-50`, `purple-100`, `purple-200`, `purple-600`, `purple-900`, `via-[#612357]`, opacity slashes `/10`, `/20`, etc.) across `src/components/CouplesPortal.tsx`, `src/components/EventQuestionsWizard.tsx`, `src/components/CoupleLayoutEditor.tsx`, `src/components/LodgingAssignmentsModal.tsx`, and `src/components/couple/CoupleTimelineTab.tsx`.

When a venue changed its branding in **Admin → Branding Management** (for example, to Emerald Green `#10b981`), the Couples Portal header border, hero gradient banner, tab navigation strip, pricing cards, add-on counter badges, and modal headers remained hardcoded to purple.

---

## 2. Exhaustive Systemic Remediation & UI/UX Elevation

### A. Universal Branding Override Engine in `src/index.css`
We expanded the global CSS override engine in `src/index.css` to dynamically map all brand purple and `#4A1942` utility classes—**including opacity slashes (`/5`, `/10`, `/15`, `/20`, `/30`, `/40`, `/60`, `/80`), linear gradients (`from-`, `via-`, `to-`), and card tints (`bg-purple-50`, `bg-purple-100`, `border-purple-200`, `text-purple-700`–`950`)**—to `var(--primary-color)`, `var(--primary-dark)`, `var(--primary-light)`, and standard `color-mix(in srgb, var(--primary-color) X%, transparent)`.

### B. Dynamic Inline Branding in `src/components/CouplesPortal.tsx`
We systematically audited all 12 portal tabs and applied dynamic inline styles reading from `const config = useBrandingConfig()`:
1. **Header Bar:**  
   - Displays the venue's branded name (`config.venueName || 'Wedding Venue'`) alongside `"💍 Couples Portal"` with a brand badge (`backgroundColor: color-mix(... 12%), color: config.primaryColor`).
   - Styled the border and **"🔄 Switch Couple"** button dynamically.
2. **Hero Header Card:**  
   - Replaced static gradient classes with an inline 3-stop linear gradient:
     ```tsx
     style={{
       background: `linear-gradient(135deg, ${config.primaryColor || '#4A1942'}, ${config.primaryLight || '#6b2c5c'}, ${config.primaryDark || '#3d1a45'})`,
     }}
     ```
   - Updated the **"✉️ Email Invite"** button text color to use `config.primaryColor`.
3. **Tab Navigation Strip:**  
   - Added `style={activeTab === t.id ? { backgroundColor: config.primaryColor || '#4A1942' } : undefined}` to the active tab button.
4. **Overview Tab (`overview`):**  
   - Styled top KPI jump strip footers, the **Recommended Next Step** banner gradient, **Planning Progress Board** completion counter pill, **Booked Package Card** header/duration badge, and **Guest Portal Share Card** copy button with dynamic branding settings.
5. **Package & Add-Ons Tab (`package`):**  
   - Mapped seasonal pricing tier cards (`Non-Peak`, `Peak`, `Premier`), duration badges, selected add-ons counter, and `+ Add` buttons to `config.primaryColor` and `color-mix(...)`.
6. **Venue Spaces Tab (`spaces`):**  
   - Styled selected venue space card borders and backgrounds with `color-mix(...)` and mapped the **"🎨 Design Floor Plan →"** button to `config.primaryColor`.
7. **Design & Approval Tab (`design`):**  
   - Styled venue admin notes, review history logs, **"Submit All Layouts for Approval"** button, and per-space **"🎨 Open layout editor"** buttons.
8. **Checklist, Vendors, Guests, Portal Settings, Chat, and Collaborators Tabs:**  
   - Mapped all primary action buttons (`+ Add`, `+ Add to My Team`, `Send →`, `+ Send Invite →`, `💾 Save portal settings`), filter pills, and message bubbles to `config.primaryColor`.

### C. Auxiliary Component Branding Integration
1. **`src/components/EventQuestionsWizard.tsx`:**  
   - Integrated `useBrandingConfig()` and styled the checkbox accent color, step navigation buttons (`activeStep === idx`), and `Save & Continue` button.
2. **`src/components/CoupleLayoutEditor.tsx`:**  
   - Integrated `useBrandingConfig()` and applied a dynamic linear gradient to the modal header, styled the `Save layout` button, grid toolbar button, and palette selection buttons (`table`, `fixture`, `decor`).
3. **`src/components/LodgingAssignmentsModal.tsx` & `CoupleTimelineTab.tsx`:**  
   - Mapped the room assignment action button and the **Day of Coordination** banner to dynamic branding settings.

---

## 3. Automated Test Coverage & Verification

- **New Test Suite (`src/components/CouplesPortal.universalBranding.test.tsx`):**  
  - `applies branding settings (primaryColor and venueName) to Header, Hero Banner, and Tab buttons`: Proves that when `config.primaryColor` is set to `#10b981` ("Emerald Manor"), the header displays "Emerald Manor", the active `Overview` tab button has `background-color: rgb(16, 185, 129)`, and `Switch Couple` uses `color: rgb(16, 185, 129)`.  
  - `applies branding settings to EventQuestionsWizard primary action buttons`: Proves that the `Save & Continue` button uses `background-color: rgb(16, 185, 129)`.  
  - `applies branding settings to CoupleLayoutEditor header gradient and save button`: Proves that the layout editor header uses `linear-gradient(135deg, rgb(16, 185, 129), rgb(4, 120, 87))` and the save button uses `color: rgb(16, 185, 129)`.
- **Vitest Regression Suite:** All 4 Couples Portal test files (21 total tests across `CouplesPortal.test.tsx`, `CouplesPortal.testWeddingEvent.test.tsx`, `CouplesPortal.highDensityExecutiveLayout.test.tsx`, and `CouplesPortal.universalBranding.test.tsx`) pass cleanly.
- **Full CI:** Passed `npm run typecheck`, `npm run lint:events`, unused locals validation, and single-file production bundle build (`npm run build`).
