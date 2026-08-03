# Final Platform QA Sweep

Consolidated QA of the Intelligence Platform workstream (Features A–I) after all
features landed. Full CI green: **295 tests / 11 skipped**, clean typecheck +
event-bus lint, production build succeeds.

## Bugs found & fixed this sweep

### BUG-1 (Feature F, security) — Guest-portal sign-in never used the server-side token RPC
The GuestPortal sign-in handler still called the **local** `findGuestInEvent`
utility even when the platform was in Supabase mode, so the security-critical
`get_guest_by_portal_token` RPC was never reached — server-verified identity
was effectively not wired in.
**Fix:** The sign-in now calls `getGuestPortalBackend().findGuest()` when the
provider is `supabase` (falling back to local lookup otherwise). Local behavior
is fully preserved.

### BUG-2 (Feature F) — Resolved guest didn't carry the token, so RSVP fell back to local
`SupabaseGuestPortalBackend.findGuest` returned a record without the token, so
`identifiedGuest.token` was undefined and RSVP submission silently fell back to
local storage instead of the `submit_guest_rsvp` RPC.
**Fix:** The resolved guest now carries the token; added a regression assertion.

### BUG-3 (Feature E, perf) — Realtime channel re-subscribed on every render
`useLayoutBackendSync` built a fresh `context` object literal each render, and
the realtime-subscribe effect depended on `context` → the Supabase Realtime
channel was **unsubscribed/re-subscribed on every render** (connection churn).
**Fix:** `context` is now `useMemo`'d on `[userId, organizationId]`, and the hook
returns a stable object via `useMemo`.

### BUG-4 (Feature H, perf) — `spm_data_changed` listener re-registered on every render
`useEntityBackendSync` returned a fresh object each render, and
`AuthenticatedApp`'s effect depended on that object → the global listener was
removed/re-added on every render.
**Fix:** Same treatment — memoized `context` + stable return object in
`useEntityBackendSync`.

## Verified-good (no change)
- **Local mode fully preserved**: `canSync*`/provider guards mean no Supabase
  client call ever happens when the platform is local; the smoke/login/guest
  tests all pass unchanged.
- **No import cycles**: `useLayoutState` doesn't import the repositories;
  production build confirms the bundle resolves.
- **Accept-invite route is loop-free**: clearing the hash exits the invite
  branch; no blocking `alert()`/`confirm()` in any platform UI.
- **Repository replace-sync** (layouts) and `org_data` upsert (entities) are
  correct against the schema.
- Platform helper `platformLabel`/`isPlatformEnabled` are unused-but-harmless.

## Note (non-blocking)
After accepting an invite for a *different* organization, the user's
`organizationId` isn't refreshed until a re-login (it's captured at sign-in).
Works as designed for the primary org; a follow-up could re-fetch membership on
invite-accept so the new org scope applies immediately.
