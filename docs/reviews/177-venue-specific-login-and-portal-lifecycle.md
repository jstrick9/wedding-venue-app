# Review #177 — Venue-Specific Login and Invite Portal Lifecycle

**Date:** 2026-08-18
**Status:** Implemented in code; migration and live browser verification pending

## User-approved behavior

- The root application is a neutral platform login.
- Each venue has a slug-specific staff login page.
- Venue login is limited to venue administrators, managers, planners, and staff with an active membership in that venue organization.
- Couples and wedding guests cannot enter the venue workspace through venue login.
- Couples and collaborators continue to use invite links only.
- Guests use a couple-scoped token and see only the event(s) to which the couple assigned them.
- Couple/co-owner/planner/family/vendor permissions remain distinct; a couple can explicitly grant co-owner-level access.
- Couple, collaborator, and guest links expire after the full calendar day following the couple's final event day.
- Venue and couple users can reissue links without deleting event, guest, RSVP, assignment, or chat history.
- The current Seven Paths Manor organization/data should be preserved as the first tenant.

## Changes implemented

### Routes and branding

- Added neutral `PlatformLoginScreen` for the root/`#/platform-login` route.
- Added `VenueLoginScreen` for `#/venue-login/<venue-slug>`.
- Added public `get_public_venue_branding(slug)` RPC in migration `0007`.
- Venue login and public couple/guest portals can load safe venue branding without exposing organization rows or `org_data` directly.
- Venue login uses organization-scoped Supabase sign-in; a valid Auth user from another venue is rejected.
- Venue/platform login pages hide planner and wedding-guest entry buttons.
- Couple/guest invite routes bypass venue login.

### Tenant-bound links

- New couple and guest links carry the venue slug as a query parameter.
- New venue-bound RPC wrappers verify the slug against the snapshot's `organization_id`.
- Legacy token-only public RPCs remain available for existing links while new links use explicit venue binding.

### Link lifecycle

- Couple events now track invite issue/expiry metadata.
- Collaborators track issue/expiry/revocation metadata.
- Couple guest records track guest-token issue/expiry metadata.
- Supabase RPCs reject expired couple, collaborator, and guest tokens.
- Local UI enforces the same lifecycle for production builds; test mode permits historical fixtures.
- Couple owner, venue admin, and guest-management flows can rotate tokens without deleting business history.

### Guest event access

The existing per-couple `guestEventIds` assignment model is retained and is now the authoritative UX boundary for guests invited to multiple events. A guest has one couple-scoped token and sees only assigned rehearsal, ceremony, reception, lodging, or custom events.

## Required live setup

Apply migrations `0006_platform_tenancy.sql` and `0007_public_venue_branding_and_access_lifecycle.sql` after `0001`–`0005`.

For the existing first venue, preserve the organization/data and assign its slug, for example:

```sql
update public.organizations
set slug = 'seven-paths-manor'
where lower(name) = lower('Seven Paths Manor');
```

Only run that statement after confirming the slug is not already used by another organization.

## Live smoke test

1. Open the root URL: it must show neutral Platform Administration branding, not Seven Paths Manor.
2. Platform owner creates/opens a venue organization.
3. Open `#/venue-login/<slug>`; safe venue branding appears.
4. Venue member signs in successfully; an Auth user from another organization is rejected.
5. Open a couple link; it does not show venue login.
6. Open a guest link; it does not show venue login and only assigned couple events appear.
7. Reissue a couple link and confirm the old link no longer resolves after snapshot synchronization.
8. Reissue a guest link and confirm the guest's prior RSVP/history remains present with the new link.
9. Test a couple event after its final day and confirm public links are rejected.
10. Confirm venue staff can invite additional internal users through **Admin → Invite Members**.

## Validation performed

- Targeted portal/login tests passed after the lifecycle changes.
- `npm run typecheck` passed during implementation checkpoints.
- `npm run lint:events` passed during implementation checkpoints.
- Production build passed during implementation checkpoints.
- Final migration/RLS behavior and cross-venue isolation require the user's live Supabase project.

## Follow-up hardening

- Add a production email-confirmation pending flow for venue-admin and invited staff onboarding.
- Require MFA for platform owners/admins.
- Connect venue and platform onboarding links to the transactional email Edge Function.
- Add server-side support/reissue audit entries for every token rotation.
- Add a venue timezone column and use it instead of the current America/New_York fallback for multi-region operation.
