# Review #175 — Cross-Device Supabase Implementation for One Venue / Many Couples

**Repository:** `jstrick9/wedding-venue-app-old`  
**Date:** 2026-08-18  
**Selected architecture:** Supabase + Vercel + invite-link access  
**Live project status:** Not created yet; live RLS/Reatime/Storage/Edge verification remains pending.

## 1. Objective

LocalStorage cannot share live records between different browsers/devices. This pass adds the backend path required for:

- Venue staff to maintain one shared venue workspace.
- Couples to open their invite link on another device and retrieve their event/planning data.
- Guests to open a per-couple guest link on another device and retrieve their guest identity, portal configuration, venue information, itinerary, and RSVP.
- Guest RSVP changes to reach the couple/venue snapshot through a server-validated RPC.
- Venue-side changes to reach remote couple devices through Supabase mirror data and polling/realtime invalidation.

Local mode remains the default and continues to work without Supabase.

## 2. Architecture added

### 2.1 Authenticated venue workspace

- The existing `org_data` JSON mirror now treats all business domains as syncable except local-only user authentication, security settings, session/read-marker state, and the dedicated saved-layout domain.
- `useEntityBackendSync` pulls remote organization data at startup and subscribes to `org_data` plus couple snapshot changes.
- Remote hydration emits `backend_hydrated`, which refreshes local React state without causing a push loop.
- Local versioned writes emit typed data-change notifications carrying their storage key; the repository resolves storage keys to business domains for cloud persistence.
- Couple snapshots are registered/updated from the authenticated venue workspace and stale snapshots are removed after couple deletion.

### 2.2 Couple/collaborator invite-link access

New `supabase/migrations/0005_couple_portal_sync.sql` adds:

- `couple_portal_snapshots` table keyed by the local `CoupleEvent` id and organization id.
- Organization-authenticated snapshot upsert RPC.
- Public token-validated couple/collaborator snapshot read/write RPCs.
- Public token-validated guest snapshot read RPC.
- Public token-validated guest RSVP write RPC.
- Realtime publication for the couple snapshot table.

`src/services/couples/coupleCloudSync.ts` builds event-scoped snapshots so one couple's couple-scoped records are not bundled into another couple's snapshot. Global one-venue catalog/presentation data is included for the remote couple/guest experience.

### 2.3 Guest device experience

`GuestPortal` now:

- Uses the couple-scoped token RPC when Supabase is enabled.
- Hydrates the event, guest, RSVP, venue, map, rules, weather, and itinerary data when the browser has no local copy.
- Writes guest RSVP changes through the token-validated couple RSVP RPC.
- Polls the remote guest snapshot approximately every five seconds for cross-device changes.

### 2.4 Bootstrap fixes

- Added an initial owner-membership RLS policy so the first Supabase user can create the owner membership during sign-up.
- `AuthBackend` now maps Supabase `owner` to local admin authority.
- Organization and membership bootstrap errors are no longer ignored.
- `0003_org_data.sql` registers the organization mirror with Supabase Realtime.

## 3. Required deployment procedure

1. Create a Supabase project.
2. Apply migrations `0001_initial.sql` through `0005_couple_portal_sync.sql` in order.
3. Configure Vercel environment variables:
   ```ini
   VITE_BACKEND_PROVIDER=supabase
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```
4. Deploy the Vite application to Vercel.
5. Configure/deploy the existing `send-email` Edge Function if transactional email is needed.
6. Perform the device smoke test:
   - **Device A:** register the venue owner, create/update a couple event, and create a couple guest.
   - **Device B:** open the couple invite link, verify the event/space/package/guest data, edit a couple-owned record, and wait for the venue snapshot update.
   - **Device C:** open the guest invite link, verify guest identity and portal content, submit an RSVP, then verify the RSVP on Devices A and B.
   - Delete a couple event on Device A and verify its old invite no longer resolves after the next sync.

## 4. Current limitations requiring live verification/hardening

- No Supabase project exists in the workspace yet, so migrations, RLS, Realtime publication, and public RPC behavior have not been executed against Postgres.
- Couple/guest snapshot refresh currently polls at approximately five seconds; the table is Realtime-published, but public invite-link consumers still use polling for predictable token-scoped reads.
- Snapshot payloads remain private to the snapshot table/RPC path, but raw invite/guest tokens are retained inside the private couple snapshot so couple owners can continue generating links after hydration. A follow-up should store only hashes plus a secure link-rotation flow.
- The generic `org_data` policy is intentionally suitable for the first single-venue project but still needs least-privilege role policies before broad staff access.
- Local fallback remains available when the provider is not configured. Once Supabase mode is selected for a real venue, cloud write failures should be surfaced rather than silently treated as successful local-only writes.

## 5. Validation completed without a live project

- TypeScript typecheck: green.
- Typed event-bus lint: green.
- Targeted cloud seam tests: green, including owner bootstrap mock, couple snapshot scoping/hydration, repository seam, and guest backend tests.
- Existing local multi-couple suite remains green.
- Live Supabase/RLS/Realtime/Edge Function validation: pending project creation.

*End of Review #175.*
