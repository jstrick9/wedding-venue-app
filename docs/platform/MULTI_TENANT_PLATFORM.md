# Multi-Tenant Platform Administration

> **Implementation status:** Review #176 adds the platform-control layer for the selected architecture: one Supabase project, organization-level tenant isolation, one initial platform owner, platform-created venue organizations, and one-time managed venue-admin onboarding. The migration and frontend flow still require application in the live Supabase project and a live browser smoke test.

## Target operating model

```text
Platform owner / platform admin
  └── Platform Admin Console
        ├── Create a venue organization
        ├── Generate a one-time managed-admin setup link
        ├── View tenant metadata and managed administrators
        └── Review platform audit records

Venue managed administrator
  └── Venue Workspace
        ├── Configure venue catalogs, layouts, rules, and branding
        ├── Invite internal admins, planners, and staff
        ├── Manage couples and guest portals
        └── Manage venue-scoped business data

Couple / collaborator / guest
  └── Scoped invite-link portals
```

The word **organization** in the application database means one venue workspace. It is not the same as a Supabase billing organization.

## Tenant architecture

The initial deployment uses one Supabase project:

- `public.organizations` — one tenant row per venue.
- `public.organization_memberships` — venue-scoped users and roles.
- `public.platform_memberships` — global platform roles, separate from venue roles.
- Existing business tables and `org_data` remain protected by organization/event RLS.
- `couple_portal_snapshots` remains token-scoped for public couple/guest access.
- Migration `0007_public_venue_branding_and_access_lifecycle.sql` exposes only safe public venue branding by slug and enforces invite expiration server-side.

A user may have both:

- `platform_memberships.role = platform_owner`, and
- `organization_memberships.role = owner` for their own venue.

That is the expected configuration for the first platform operator of a single-venue deployment.

## Roles

### Platform roles

| Role | Purpose |
|---|---|
| `platform_owner` | First internal platform operator; can create/manage venue tenants and platform administrators. |
| `platform_admin` | Internal platform administrator with tenant metadata/onboarding access. |
| `platform_support` | Future support role; audit foundation exists, but broad tenant data access is not automatically granted. |

### Venue roles

| Role | Purpose |
|---|---|
| `owner` | Initial managed venue administrator; mapped to the app's Admin authority. |
| `admin` | Additional venue administrator; can use venue Admin Settings and invite internal staff. |
| `planner` | Venue planner with organization/event access as defined by existing RLS. |
| `staff` | Venue operations staff. |

The app must not use localStorage's old `admin` user as the cloud authority. In Supabase mode, the authoritative roles are the platform and organization membership tables.

## Apply the new migration

After migrations `0001` through `0005` are already applied, run these files in order:

```text
supabase/migrations/0006_platform_tenancy.sql
supabase/migrations/0007_public_venue_branding_and_access_lifecycle.sql
supabase/migrations/0008_platform_console_management.sql
supabase/migrations/0009_platform_branding_chat_and_venue_location.sql
supabase/migrations/0010_guest_rsvp_hardening_org_data_and_chat.sql
supabase/migrations/0011_couple_workspace_projection.sql
supabase/migrations/0012_update_venue_organization.sql
```

Run each once in Supabase SQL Editor or through the Supabase CLI. Do not rerun a partially successful migration without checking which objects were created.

## Bootstrap the first platform owner

The first platform owner is intentionally not self-claimable from the public browser. After the Auth user exists and migration `0006` is applied, run this once in Supabase SQL Editor, replacing the email:

```sql
insert into public.platform_memberships (user_id, role, status)
select id, 'platform_owner', 'active'
from auth.users
where lower(email) = lower('YOUR_PLATFORM_EMAIL@example.com')
on conflict (user_id)
do update set
  role = 'platform_owner',
  status = 'active',
  updated_at = now();
```

If the operator also owns the existing first venue, ensure they have an active `owner` membership in that venue's `organization_memberships` table. Existing venue data should be preserved rather than copied into a second organization.

After the SQL runs:

1. Sign out of the application.
2. Sign in again with the Supabase email/password.
3. Open the root application URL or `#/platform-admin`.
4. The Platform Admin Console should appear.

## Login and public portal boundaries

- The root route is a neutral platform login (`#/platform-login`). It is not branded as a venue.
- Each venue has a staff login route using its tenant slug: `#/venue-login/<venue-slug>`.
- The venue login resolves safe branding through the public branding RPC and only accepts an active membership in that organization.
- Couples and wedding guests do not receive venue login controls. Their invite links open the appropriate public portal directly.
- New couple and guest links carry the venue slug and are checked against the organization stored on the server snapshot. Legacy token-only links remain available for migration compatibility.

## Portal access lifecycle and reissue

Couple, collaborator, and guest links are event-scoped bearer links. By default, access remains available through the full calendar day after the couple's final event day, then expires. If an event has no date yet, a temporary 30-day fallback is used until the venue sets dates.

Reissuing a link rotates only its bearer token. It does not delete or replace:

- couple planning data;
- collaborators and their roles;
- guest records;
- event assignments;
- RSVP submissions;
- couple chat/history.

The venue can reissue couple and guest links from the venue Couples management screen. A couple owner can reissue their own couple link, collaborator links, and guest links from the Couples Portal. The old token stops resolving after the new snapshot is synchronized.

Couple collaborator roles remain distinct:

- `couple` / co-owner — full couple-level access when explicitly granted;
- `planner` — planning edits such as layouts and guests;
- `family` — view/answer/chat access;
- `vendor` — view/chat access.

## Platform-admin onboarding flow

1. Platform owner opens the Platform Admin Console.
2. Platform owner enters:
   - venue name;
   - optional slug;
   - initial managed-admin email.
3. The RPC creates a tenant with no owner yet and stores only a hash of the one-time setup token.
4. The console displays a setup URL one time for copying.
5. The invited venue administrator opens the link and creates their own Supabase Auth account.
6. The secure RPC verifies the invite token and matching email, claims the organization, creates an active `owner` membership, and marks the invite accepted.
7. The venue administrator signs in and sees Admin Settings for that venue.

The current first release displays/copies the setup URL. Transactional email delivery can be connected to the existing email Edge Function after the tenant workflow is smoke-tested.

## Venue-admin account management

Venue administrators should use **Admin → Invite Members** to invite additional venue admins, planners, and staff. Those invitations are organization-scoped and use the existing `org_invites` and `accept_invite` path.

The legacy local User Management form still represents local browser records. It must not be treated as the cloud source of truth for Supabase users. Cloud account provisioning should use invitation links and Supabase Auth.

## Security boundaries

- The public browser never receives a service-role key.
- Platform-admin metadata access is separate from tenant business-data access.
- Platform administrators are not automatically granted broad reads of `org_data` or private couple snapshots.
- `platform_audit_logs` provides the foundation for future audited break-glass support sessions.
- MFA is intentionally deferred until after the first working platform-owner/venue-admin flow, but should be required before production platform operations.
- Email-confirmation onboarding needs a pending-confirmation UX before production. The current invite sign-up path expects an immediate Supabase session during the initial test flow.

## Live smoke test

### Platform owner

- Sign in at the root and see Platform Admin Console.
- Create a test venue.
- Copy the managed-admin setup link.
- Confirm a row appears in `public.organizations` with a null `owner_id`.
- Confirm a pending row appears in `public.venue_admin_invites`.
- Confirm `get_public_venue_branding(slug)` returns only safe branding fields.

### Managed venue administrator

- Open the setup link in a separate browser/device.
- Create the invited account using the invited email.
- Confirm `organizations.owner_id` is populated.
- Confirm `organization_memberships` contains `role = owner` and `status = active`.
- Sign in again and confirm Admin Settings is available.

### Tenant isolation

- Create or accept a second test venue.
- Confirm the first venue administrator cannot list or modify the second venue's organization metadata or business data.
- Confirm platform owner can see tenant metadata but does not automatically receive private couple snapshot data.

### Existing cross-device path

- In the first venue workspace, save/edit a couple event after cloud mode is active.
- Confirm `couple_portal_snapshots` receives the event snapshot.
- Open the couple link on another device.
- Confirm the guest link and RSVP flow remain scoped to that couple event.
