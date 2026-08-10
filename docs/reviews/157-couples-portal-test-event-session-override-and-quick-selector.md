# Review #157 — Couples Portal: Stale Session Override Resolution & Interactive Test-Wedding Quick Selector

**Date:** 2026-08-10  
**Author:** jstrick9 (Wedding Venue Product / Full-Stack / UI/UX / QA Expert)  
**Status:** Completed & Tested

---

## 1. Executive Summary & Root Cause Investigation

### Problem Reported
When creating a test wedding event in the venue admin portal and attempting to open its Couples Portal (`#/couples-portal?token=<inviteToken>`), the portal would either:
1. Fail to switch to the newly created test event (displaying an old previously opened couple event instead), or
2. Fail to open and show an un-interactive "Sign in with the invitation link you received" message with no way to enter a token or select the new test event.

### Exhaustive Root Cause Discovery
We conducted an architectural trace of the Couples Portal entry flow across `src/components/CouplesPortal.tsx`, `src/App.tsx`, and `src/services/couples/coupleService.ts` and identified three compounding bugs:

1. **Bug 1 — Stale Session Blocking Token Resolution (`if (session) return;`):**  
   In `CouplesPortal.tsx`, the token resolution effect previously began with `if (session) return;`. Because couple sessions in `localStorage` have a 30-day TTL (`SESSION_TTL_MS`), any previously stored session (e.g., default demo couple "Elena & Marcus" or an older test event) remained active. When navigating to `#/couples-portal?token=cp-new-event`, `session` evaluated as truthy, causing the effect to exit immediately and completely ignore the new token.
2. **Bug 2 — Side-Effect in Location Token Getter (`getCoupleTokenFromLocation`):**  
   `getCoupleTokenFromLocation(location)` was executing `window.history.replaceState(null, '', base)` to strip the token parameter from the URL hash during render evaluation. If React re-rendered before authentication completed, `coupleToken` became `undefined`.
3. **Bug 3 — Un-Interactive Fallback / Empty State Screen:**  
   When opening `#/couples-portal` without a token or after logging out, the UI displayed a static message with only a "Return to Login" button, offering zero affordance for testing newly created wedding events locally.

---

## 2. Systemic Technical & UI/UX Remediation

1. **Dynamic Session Override in `CouplesPortal.tsx`:**  
   - Replaced `if (session) return;` with an intelligent check: whenever `coupleToken` (or URL hash token) is present, we resolve it using `resolveCoupleInviteToken`.
   - If the token points to a different couple event or collaborator than the currently active `session`, we immediately overwrite the stored session (`saveCoupleSession(...)`), clear `invalidInvite`, and synchronize the active event to the newly requested test wedding event.
2. **Pure `getCoupleTokenFromLocation` Getter (`coupleService.ts`):**  
   - Removed `window.history.replaceState(...)` from `getCoupleTokenFromLocation(location)` so it operates as a 100% pure getter function that cannot lose the URL token across React render passes.
3. **Interactive Sign-In & Quick-Select Test Mode Screen (`CouplesPortal.tsx`):**  
   - Transformed the `invalidInvite` and `!session || !event || !me` screens into a comprehensive, interactive **Couples Portal Access & Test Mode** screen featuring:
     - **⚡ Quick-Select Booked Couple (Test Mode):** A dropdown selector listing every couple event stored in `localStorage` (showing couple name, event date, and invite token) paired with a 1-click **"Launch ↗"** button.
     - **🔑 Enter Invitation Token:** A manual token input field with keyboard Enter submission and **"Sign In"** button.
   - Added a **"🔄 Switch Couple"** action button in the Couples Portal top navigation bar next to "Sign out", allowing users to jump back to the Quick-Select screen without leaving the portal.
4. **Real-Time Event List Synchronization:**  
   - Inside the token resolution effect and `handleManualLaunch`, `getCoupleEvents()` is explicitly called to refresh event state from `localStorage` before matching tokens, ensuring that a couple event created seconds earlier in another tab is immediately found.

---

## 3. Comprehensive Test Coverage & CI Verification

- **New Automated Test Suite (`src/components/CouplesPortal.testWeddingEvent.test.tsx`):**  
  1. `overrides an existing stored session when opening a newly created test wedding event via token`: Proves that when an old couple session is active in `localStorage`, launching CouplesPortal with a new test event token overrides the session and opens the new test event.  
  2. `allows selecting a created test wedding event from the Quick-Select dropdown when no session is active`: Proves that when no session exists, the user can select their test wedding event from the Quick-Select dropdown and launch directly into the portal.
- **Vitest Regression Suite:** All 11 existing tests in `src/components/CouplesPortal.test.tsx` pass cleanly alongside the 2 new tests in `CouplesPortal.testWeddingEvent.test.tsx`.
- **Full CI Checks:** Passed `npm run typecheck` (0 errors), `npm run lint:events` (`✓ No raw spm_* event-bus usage`), unused locals verification, and single-file build (`npm run build`).
