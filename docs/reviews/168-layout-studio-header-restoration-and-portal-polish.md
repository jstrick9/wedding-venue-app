# Review #168: Layout Studio Header Restoration, Branding Upload Hardening & Portal Navigation Cleanup

## Summary of Findings & Remediations

During our continuous autonomous UX, design, and functional remediation of the **Wedding Venue Intelligence Platform** (React 19 + Vite + TypeScript SPA, single-file build via `vite:singlefile`) across all three personas (Venue Admin → Couple → Guest), we executed a comprehensive cleanup of the Layout Studio header, resolved a logo upload blocker in Branding Management, and refined portal navigation and headers:

### 1. Design Studio Header (`Header.tsx`) Restoration & Studio Menu Refinement
- **Finding:** In our previous review (#167), we mistakenly removed `<Header.tsx>` from the top of the Layout Studio in `AuthenticatedApp.tsx` and moved all controls into `Sidebar.tsx`. You clarified that `<Header.tsx>` (with the venue layout switcher dropdown and Menu button) should remain at the top of the Layout Studio, while the left side of `<Header.tsx>` should house **`🗺️ Venue Map`** and **`🏛️ Spaces & Layouts`** without venue branding text.
- **Remediation (`src/components/Header.tsx`, `src/components/AuthenticatedApp.tsx`, `src/components/Sidebar.tsx`):**
  - **Restored `<Header.tsx>`:** Restored `<Header />` at the top of the Layout Studio (`view === 'studio'`) in `AuthenticatedApp.tsx`.
  - **Left Side of Header:** Removed all venue branding text (`config.logoUrl`, `config.venueName`, "Wedding Layout Planner", website/email) from the left side of `Header.tsx` and placed prominent 1-click buttons for **`🗺️ Venue Map`** (`onOpenVenueMap`) and **`🏛️ Spaces & Layouts`** (`onShowSpacesLayouts`).
  - **Right Side of Header & Menu Dropdown:** Kept the venue layout switcher dropdown (`Venue: [Main Hall ▼]`) and Menu button (`☰ Menu`). Inside the Menu dropdown (`showMenu`):
    - **Added/Moved:** **`⚙️ Admin & System Settings`** (`onShowAdmin`) and **`🛠️ Operations Studio`** (`onOpenOperations`) into the menu.
    - **Removed:** **`📋 Templates`** and **`🚪 Sign Out`** from both desktop and mobile studio menus.
  - **Sidebar Cleaned Up:** Restored `Sidebar.tsx` ("Layout Tools") to be the standard CAD/layout tool sidebar without extra header buttons.

### 2. Branding Management Logo Upload Blocker (`BrandingManagement.tsx`)
- **Finding:** In `BrandingManagement.tsx` (`#/admin` -> Branding -> Logo & Identity), `handleLogoUpload` was being destructured from `props` (`AdminCommonProps`). However, `AdminPanel.tsx` did not pass `handleLogoUpload` in `commonProps`, causing `onChange={undefined}` on the file input and preventing admins from uploading a logo file.
- **Remediation (`src/components/admin/BrandingManagement.tsx`):** Implemented `handleLogoUpload` directly inside `BrandingManagement.tsx` using `FileReader` to read uploaded image files as base64 data URIs and immediately call `handleSaveConfig({ ...config, logoUrl: dataUrl })` and `onShowSuccess('Logo uploaded successfully!')`. Both the logo thumbnail click and "Upload Logo" / "Change Logo" button now open the file picker and upload logos reliably.

### 3. Live Preview Section Heading & Landing Page Mirroring (`BrandingManagement.tsx`)
- **Finding:** In `BrandingManagement.tsx`, the live preview section title read `"👁️ Live Home & Landing Page / Venue Dashboard Preview"` and did not reflect the upgraded Landing Page left sidebar.
- **Remediation:**
  - Upgraded the section heading to read **`👁️ Live Preview`** (`<h3 className="font-bold text-base text-gray-900">👁️ Live Preview</h3>`).
  - Updated the actual preview card to accurately mirror the actual Home/Landing page, including a left sidebar preview displaying `✉️ Email`, `🌐 Website`, `Welcome back to Seven Paths Manor` in a `rounded-2xl shadow-md` banner, `● Active Brand`, and interactive KPI stat cards.

### 4. Venue Email Link Parity (`VenueDashboard.tsx`, `Header.tsx`)
- **Finding:** In `VenueDashboard.tsx` (Landing Page left sidebar), the email address link displayed the raw email string rather than the word "Email" like the "Website" link.
- **Remediation:** Standardized the email link to read **`✉️ Email`** (`<a href="mailto:..." title="Email: ..."><span>✉️</span><span>Email</span></a>`) alongside **`🌐 Website`** in both `VenueDashboard.tsx` and `Header.tsx`.

### 5. Home Page Header System Settings Button Removal (`VenueDashboard.tsx`)
- **Finding:** The Home page header (`section === 'home'` in `VenueDashboard.tsx`) included a `"⚙️ System Settings"` button, which was redundant with the left sidebar navigation menu.
- **Remediation:** Removed the `"⚙️ System Settings"` button from the Home page header.

### 6. Portal Chat, Vendors, Timeline, and Operations Header Cleanup (`VenueChatPanel.tsx`, `VendorPanel.tsx`, `TimelinePanel.tsx`, `StaffOperationsPanel.tsx`)
- **Finding:** When embedded inside `VenueDashboard.tsx` (`inline === true`), `Portal Chat`, `Vendors`, `Timeline`, and `Operations` rendered an explicit `"✕"` close page button in their headers, which was unnecessary when navigating via the left sidebar menu. Additionally, `Vendors` and `Operations` headers included a `"🖨️ Print Directory"` / `"🖨️ Print Sheet"` button in the header.
- **Remediation:**
  - Removed the `"✕"` close page button from the header of `Portal Chat`, `Vendors`, `Timeline`, and `Operations` when `inline === true`.
  - Removed the `"🖨️ Print Directory"` / `"🖨️ Print Sheet"` button from the headers of `VendorPanel.tsx` and `StaffOperationsPanel.tsx` (added a `"🖨️ Print BEO"` button to the BEO Sheet tab toolbar in `StaffOperationsPanel.tsx` so authorized admins can still print BEOs without header clutter).

---

## Automated Verification & CI Status
- **Audit Test Suite Updates:** Updated `src/components/admin/VenuePortal.designConsistencyAudit.test.tsx` (14 comprehensive tests) to assert Layout Studio `<Header>` layout (`Spaces & Layouts` and `Venue Map` on left, `Admin & System Settings` and `Operations Studio` in menu, without `Templates` or `Sign out`), Landing Page left sidebar `✉️ Email` label parity, Home header system settings omission, and Branding Management logo upload presence.
- **Full Test Suite:** All **738 tests across 163 test files** pass cleanly.
- **Static & Event Checks:** 100% clean TypeScript typecheck (`npm run typecheck`), clean event bus linting (`npm run lint:events`), and clean unused-locals check.
- **Single-File Bundle:** Built cleanly via `npm run build` (`dist/index.html` ~1,779.92 kB / gzip ~405.61 kB).
