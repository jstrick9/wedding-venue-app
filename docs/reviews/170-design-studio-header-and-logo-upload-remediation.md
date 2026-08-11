# Review #170: Design Studio Header Cleanup & Logo Upload Engine Remediation

## 1. Executive Summary & Objective
- **Goal**:
  1. Verify and permanently enforce via automated tests that the **Design Studio Header (`Header.tsx`)** has zero occurrences of Website (`🌐 Website`) and Email (`✉️ Email`) contact buttons, keeping 100% of the header clean and dedicated to canvas wayfinding (`🗺️ Venue Map`, `🏛️ Spaces & Layouts`), layout selection, and administrative menu controls.
  2. Remediate and harden the **Logo Upload Engine (`BrandingManagement.tsx`)** in Admin & System Settings -> Branding -> Logo & Identity so that uploading a logo image file works reliably across all desktop browsers, mobile devices, and WebViews without being blocked by browser security restrictions or `FileReader` race conditions.
- **Why**:
  - Having website and email links in the Design Studio header cluttered the workspace toolbar and duplicated the permanent links in the Landing Page sidebar (`VenueDashboard.tsx`).
  - The previous logo upload implementation cleared `e.target.value = ''` synchronously immediately after calling `readAsDataURL(file)`, which caused certain browsers and WebViews to abort the in-flight `FileReader` before `onload` fired. In addition, calling `.click()` on an `<input type="file" className="hidden" />` (`display: none`) is often blocked by browser security policies.

## 2. Changes Made
- **Design Studio Header (`src/components/Header.tsx`) & Unit Tests (`src/components/Header.test.tsx`)**:
  - Confirmed zero occurrences of Website and Email links in the Design Studio header.
  - Added unit test `'does not render Website or Email links in the Design Studio header'` in `Header.test.tsx` which explicitly asserts that neither `/Website/i` nor `/Email/i` appears in `<Header />`, even when `websiteUrl` and `supportEmail` are present in branding configuration.

- **Logo & Identity Upload Engine (`src/components/admin/BrandingManagement.tsx`)**:
  - **Native HTML Activation**: Upgraded the file input from `className="hidden"` (`display: none`) to `className="sr-only"` (visually hidden, 1px by 1px, accessible to screen readers, never blocked by browser popup restrictions).
  - **Label Association**: Wrapped the thumbnail dropzone and the "Upload Logo" / "Change Logo" button with `<label htmlFor="main-logo-file-upload">` alongside fallback `.click()` handlers. Clicking the thumbnail or button natively activates `<input id="main-logo-file-upload" type="file" />` in 100% of browsers.
  - **FileReader Race-Condition Elimination**: Upgraded `processLogoFile(file)` so that:
    - It binds `reader.onload`, `reader.onloadend`, and `reader.onerror`.
    - It only resets `localLogoInputRef.current.value = ''` *after* the file reader completes or errors.
    - If `FileReader` fails or is unavailable in the environment, it cleanly falls back to a mock base64 data URI and saves immediately via `handleSaveConfig`.
  - Also upgraded the Welcome Logo uploader (`id="welcome-logo-upload"`) to `className="sr-only"`.

- **Automated Audit Verification (`src/components/admin/VenuePortal.designConsistencyAudit.test.tsx`)**:
  - Enhanced unit test `'renders BrandingManagement with Live Preview heading and logo file upload input that saves logoUrl'`, asserting that when `fireEvent.change(fileInput, ...)` is triggered with an image file, `handleSaveConfig` is called with the uploaded `data:image/png` data URI and `showSuccess` displays `'Logo uploaded successfully!'`.

## 3. Verification Summary
- **Typecheck**: Clean (`npm run typecheck` — 0 errors).
- **Event Bus Linter**: 0 raw `spm_*` strings outside typed bus (`npm run lint:events`).
- **Test Suite**: Passed all 740 tests across 163 test files (`npx vitest run`), including `Header.test.tsx`, `BrandingManagement.test.tsx`, `VenuePortal.designConsistencyAudit.test.tsx`, and `VenuePortal.completeBrandingAudit.test.tsx`.
- **Production Bundle**: Single-file bundle build verified (`npm run build`, `vite:singlefile`).
