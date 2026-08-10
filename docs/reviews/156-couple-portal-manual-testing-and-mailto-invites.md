# Review #156 — Couples Portal Manual Testing Architecture & Universal 1-Click Email Invite (`mailto:`) Integration

**Date:** 2026-08-10  
**Author:** jstrick9 (Wedding Venue Product / Full-Stack / UI/UX / Quality Assurance Expert)  
**Status:** Completed & Tested

---

## 1. Executive Summary & Answer to User Query

### "I want to be able to manually test the couple portal. Is there a way to send an invite link without external infrastructure?"

**YES, absolutely.** The **Wedding Venue Intelligence Platform** is architected to operate fully in **LocalStorage Active Provider mode** by default (`src/platform.ts`), meaning you can create couple events, generate invite links, test the Couples Portal end-to-end, and send/share invitation links without any external backend infrastructure, database (Supabase), or email API (Resend).

### Why No External Infrastructure is Required
1. **Local-First Browser State:** All booked couples, unique invite tokens (`cp-...`), interactive floor plan layouts, guest lists, RSVPs, timeline events, and venue↔couple chat messages reside in versioned local storage in your browser (`localStorage`).
2. **Same-Browser Token Authentication:** Opening a Couples Portal invitation URL (`#/couples-portal?token=<inviteToken>`) in any tab or window within the same browser profile instantly authenticates as that couple against your venue's active local data.
3. **Automated `mailto:` Email Fallback:** The application's email service (`src/services/couples/coupleEmailService.ts`) includes an intelligent fallback mechanism. When no external email server or API key is configured, clicking an email invitation button automatically triggers a standard `mailto:` link that opens your computer's default email client (Apple Mail, Outlook, Gmail default handler) with a pre-drafted subject line and message body containing the exact Couples Portal link.

---

## 2. Four Built-in Methods to Manually Test the Couples Portal Right Now

### Method 1: The 1-Click "Open" Button (Instant Launch)
- **Where to find:**
  - **Admin → 💍 Couples (`#/admin` → `couples` tab):** Click **"Open"** next to any couple event.
  - **Admin → Users & Permissions (`#/admin` → `users` tab → Couples view):** Click **"💍 Open Couples Portal ↗"**.
  - **Staff Operations (`#/dashboard` → Operations button / `ops` section → Couples tab):** Click **"💍 Open Couples Portal ↗"**.
  - **Wedding Timeline Panel (`#/dashboard` → Timeline section):** Click **"Open Couple Portal"**.
  - **Venue Chat Panel (`#/dashboard` → Chat section):** Click **"Open Couple Portal"**.
- **How it works:** Directly launches `window.open('#/couples-portal?token=<inviteToken>', '_blank')` in a new tab, logging you into the Couples Portal instantly.

### Method 2: Copy & Paste the Direct Invitation Link
- **Where to find:**
  - Click **"Copy invite"** (or **"📋 Copy Link"**) next to any couple event in Admin, Staff Operations, or Timeline Studio.
- **How it works:** Copies the full URL (`http://<your-host>/#/couples-portal?token=cp-...`) to your clipboard. You can paste this into a new browser tab, private browsing window (when testing against a shared origin), or share it for local testing.

### Method 3: 1-Click "✉️ Email Invite" (`mailto:` Draft Launch)
- **Where to find:**
  - Now available across **Admin → 💍 Couples (`CoupleManagement.tsx`)**, **Admin → Users & Permissions (`UserManagement.tsx`)**, and **Staff Operations (`StaffOperationsPanel.tsx`)**.
- **How it works:** Clicking **"✉️ Email invite"** immediately opens your default email client with a professionally formatted welcome subject and email message:
  ```text
  Subject: Your Wedding Planning Portal — <Couple Name>
  Body:
  Hi <Couple Name>,

  We're so excited to work with you on your wedding!

  Here is your private link to access your Couples Portal, where you can design your floor layouts, manage your guest list & RSVPs, view wedding packages, and chat directly with our venue team:

  http://localhost:5173/#/couples-portal?token=<inviteToken>

  Warm regards,
  The Seven Paths Manor Team
  ```

### Method 4: Guest & Collaborator Invite Token Testing
- **Guest Portal Testing:** In **Admin → 💍 Couples**, click **"👥 Guests"** on any event. Click the clipboard icon (`📋`) next to any guest to copy their direct **Guest Portal** RSVP link (`#/guest-portal?token=<guestToken>&couple=<coupleId>`) to test RSVP submissions, meal choices, dietary notes, and lodging access.
- **Collaborator Testing:** In any couple event with collaborators (planners, partners), click `📋` next to their name under **Collaborators** to copy their unique invite link or click `✉️` in `CouplesPortal.tsx` to email them via the `mailto:` fallback.

---

## 3. Scope of UI/UX Enhancements in Review #156

1. **Universal 1-Click "✉️ Email Invite" Buttons Added Across Venue Management Screens:**
   - **`src/components/admin/CoupleManagement.tsx`:** Added `✉️ Email invite` button in the actions row next to `Copy invite` and `Open` for each couple event.
   - **`src/components/admin/UserManagement.tsx`:** Added `✉️ Email Invite` button in the Couples view next to `📋 Copy Link`, `💍 Open Couples Portal ↗`, and `💬 Portal Chat`.
   - **`src/components/StaffOperationsPanel.tsx`:** Added `📋 Copy Portal Link` and `✉️ Email Invite` buttons in the BEO Sheet Couples tab next to `💍 Open Couples Portal ↗` and `📋 Copy BEO Link`.
2. **Test Suite Integrity Upgrades:**
   - Updated `src/components/AdminPanel.newSettings.test.tsx` to align with the new Review #155 High-Density Executive Admin Toolbar badges (`Healthy`, `LocalStorage`, `🛡️ Security`).
   - Created new unit test suite `src/components/admin/CoupleManagement.test.tsx` verifying that `CoupleManagement` renders the couple list and displays `Copy invite`, `✉️ Email invite`, and `Open` buttons, and testing that clicking `✉️ Email invite` invokes the pre-drafted `mailto:` URL containing the invite token without requiring external email infrastructure.

---

## 4. Verification & Continuous Integration

- **TypeScript (`npm run typecheck`):** Clean (0 errors across all types and components).
- **Event Bus Linter (`npm run lint:events`):** Clean (`✓ No raw spm_* event-bus usage found outside the typed bus`).
- **Unused Locals Check (`npx tsc --noEmit --noUnusedLocals`):** Clean across all source files.
- **Full Vitest Test Suite:** All automated test files passing, including `CoupleManagement.test.tsx` and `AdminPanel.newSettings.test.tsx`.
- **Single-File Build (`npm run build`):** Verified green (`dist/index.html` ~1,729.11 kB / gzip ~396.60 kB).
