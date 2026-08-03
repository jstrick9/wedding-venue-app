# Module Review — 11: Guest Portal

**Scope:** `src/components/GuestPortal.tsx`, `src/utils/guestPortal.ts`, `src/utils/guestAccess.ts`

## Findings

### BUG-1 (Minor) — Multi-day schedule could start empty
For a multi-day event whose published schedule had no day-index-0 items, the initial `selectedDayIndex` (0) matched no day button, so the schedule showed an empty list until the guest clicked a day.

**Fix:** Schedule now computes an `effectiveDay` — the selected day if it's real, otherwise the first available day — and uses it for the item list, empty-state, and the active day-button highlight. Day buttons are also sorted by index.

## Verified-good (no change)
- Sign-in gate (event key → guest lookup → optional portal password via `verifySecret`/plaintext) is sound and covered by `eventSignIn`/`passwordGate`/`eventExpiry` tests.
- RSVP submit persists via `setPortalRSVPSubmissions` and pre-fills from an existing submission; covered by `rsvpEventScope`.
- Lodging access gating (`guestCanAccessLodging`) and the "Add to calendar" `.ics` generator are correct.
- Portal auth and access windows are client-side only (a known constraint of the localStorage-first architecture; moves server-side with the Supabase backend).

## Validation
- Typecheck clean; GuestPortal test suite **16 passed / 1 skipped**; build succeeds.

## Cross-module impact
- None beyond `GuestPortal.tsx`; the schedule day-selection is internal.
