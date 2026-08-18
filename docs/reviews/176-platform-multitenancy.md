# Review #176 — Platform Admin and Multi-Tenant Venue Onboarding

**Date:** 2026-08-18
**Status:** Implemented in code; live Supabase migration and browser smoke test pending

## User-approved architecture

- One Supabase project with organization-level RLS tenant isolation.
- One initial internal platform owner, with an extensible platform role model.
- Platform-created venue organizations.
- One-time invite-link onboarding for the first managed venue administrator.
- Venue administrators manage their own venue staff/admin/planner invitations.
- Platform administrators see tenant metadata and have an audited support-access foundation; they do not automatically receive unrestricted tenant business-data access.
- MFA is deferred until after the first working release and should be required before production platform operations.
- Existing current venue/test data should be preserved and converted rather than duplicated.

## Changes implemented

### Database migration

Added `supabase/migrations/0006_platform_tenancy.sql`:

- `platform_memberships` with `platform_owner`, `platform_admin`, and `platform_support` roles.
- `is_platform_admin()` and `is_platform_support()` security-definer helpers.
- Platform metadata RLS for organizations, memberships, profiles, and existing organization invites.
- Nullable `organizations.owner_id` so a platform operator can create a tenant before the first venue Auth user exists.
- `venue_admin_invites` with hashed one-time setup tokens.
- `create_venue_organization(...)` RPC for platform-created venue tenants.
- `accept_venue_admin_invite(...)` RPC that verifies token, expiration, and invited email before claiming the tenant.
- `platform_audit_logs` as the foundation for future audited break-glass support access.

### Authentication and routing

- Supabase authentication now loads an independent platform role in addition to the venue membership role.
- A platform owner/admin maps to the local Admin authority even when they do not yet belong to a venue organization.
- Platform administrators land on the Platform Admin Console at the root or `#/platform-admin`.
- Venue workspace remains available at `#/venue` for a platform user who also belongs to a venue.
- Cloud self-service signup is hidden from the normal tenant login; regular organization accounts are invitation-oriented.
- Existing organization invites may still allow account creation on the `#/accept-invite/...` route.

### Platform Admin Console

Added `src/components/PlatformAdminPortal.tsx`:

- lists tenant metadata and managed venue administrators;
- creates a venue organization;
- generates a one-time managed-admin setup link;
- allows a platform owner who also owns a venue to open that venue workspace.

### Managed venue-admin onboarding

Added `src/components/VenueAdminOnboarding.tsx`:

- accepts a platform-generated setup link;
- allows the invited venue administrator to create their own Supabase Auth account;
- verifies the invitation email and claims the organization;
- creates the active `owner` membership used by the venue Admin Settings.

Added `signUpVenueAdminWithInvite(...)` and platform service functions under `src/services/platform/`.

## Required live setup

The first platform owner is intentionally bootstrapped once in Supabase SQL Editor. The service-role key is not used in the browser and must not be placed in Vercel.

After applying migrations `0001`–`0006`:

```sql
insert into public.platform_memberships (user_id, role, status)
select id, 'platform_owner', 'active'
from auth.users
where lower(email) = lower('YOUR_PLATFORM_EMAIL@example.com')
on conflict (user_id)
do update set role = 'platform_owner', status = 'active', updated_at = now();
```

See `docs/platform/MULTI_TENANT_PLATFORM.md` for the full bootstrap and smoke checklist.

## Validation

- `npm run typecheck` — passed.
- `npm run lint:events` — passed.
- Strict unused-locals scan — existing historical warnings remain in unrelated files; no new platform-layer warning was introduced.
- Targeted auth/login tests — passed: 3 files, 19 tests.
- `npm run build` — passed.
- Full suite should be rerun with the final platform changes before commit/push; live SQL/RLS/RPC behavior remains unverified until migration `0006` is applied to the user's Supabase project.

## Known follow-up hardening

1. Add a production email-confirmation pending flow for venue-admin onboarding.
2. Add MFA enforcement for platform owners/admins.
3. Connect the existing transactional email Edge Function to platform and venue-admin setup invites.
4. Implement audited break-glass support sessions only after the scope/reason fields and expiration behavior are reviewed.
5. Replace the legacy local User Management create/edit path with organization-backed account management in cloud mode.
6. Add live RLS, tenant-isolation, onboarding, and cross-device browser smoke tests.
