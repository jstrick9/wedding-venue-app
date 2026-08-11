# Review #169: Couples Portal Header Email Mailto Link Standardization

## 1. Executive Summary & Objective
- **Goal**: Standardize the venue email address display in the **Couples Portal header (`CouplesPortal.tsx`)** so that instead of displaying the raw email address string (`{config.supportEmail}`), it renders a clean `mailto:` link on the word **`Email`** alongside **`Website`** (`✉️ Email` and `🌐 Website`), matching the Landing Page sidebar (`VenueDashboard.tsx`) and Layout Studio header (`Header.tsx`) parity from Review #168.
- **Why**: Eliminates visual inconsistency between website link formatting (`🌐 Website`) and email contact formatting (`✉️ Email`), prevents lengthy email addresses from wrapping or overflowing the Couples Portal hero banner, and provides couples with a clear, instant 1-click action to email their venue coordinator.

## 2. Changes Made
- **Couples Portal (`src/components/CouplesPortal.tsx`)**:
  - Updated the hero banner / top header branding contact section (around line 1025).
  - Replaced `<span className="truncate max-w-[140px]">{config.supportEmail}</span>` with `<span>Email</span>`.
  - Maintained the rich `mailto:${config.supportEmail}` href and accessibility tooltip `title={`Email venue coordinator: ${config.supportEmail}`}`.
  - Ensured 100% visual symmetry with the adjacent `🌐 Website` button (`bg-white/15 px-2.5 py-1 rounded-lg transition-colors font-semibold hover:underline flex items-center gap-1.5`).

- **Automated Verification & Tests**:
  - Updated `src/components/CouplesPortal.universalBranding.test.tsx` to include `supportEmail` and `websiteUrl` in the `useBrandingConfig` mock.
  - Added test `'renders venue email address as a mailto: link on the word Email alongside Website in Header/Hero Banner'`, verifying that:
    - An email link with label `/✉️\s*Email/i` is rendered in the DOM.
    - The link has `href="mailto:coordinator@emeraldmanor.com"`.
    - The link has an informative tooltip `title="Email venue coordinator: coordinator@emeraldmanor.com"`.
    - A website link with label `/🌐\s*Website/i` is rendered alongside it with `href="https://emeraldmanor.com"`.

## 3. Verification Summary
- **Typecheck**: Clean (`npm run typecheck`).
- **Event Bus Linter**: 0 raw `spm_*` strings outside typed bus (`npm run lint:events`).
- **Test Suite**: Passed all 739 tests across 163 test files (`npx vitest run`), including `src/components/CouplesPortal.universalBranding.test.tsx` and `src/components/CouplesPortal.test.tsx`.
- **Production Bundle**: Single-file bundle build verified (`npm run build`, `vite:singlefile`).
