# Going Live: Turning the app into a true Intelligence Platform (Supabase)

> **Status (2026-08-18):** Review #175 implemented the cross-device couple/guest path and Review #176 added platform-level tenancy and managed venue-administrator onboarding. This document remains the core Supabase architecture reference; the multi-tenant operating flow is documented in `docs/platform/MULTI_TENANT_PLATFORM.md`. Neither path is live-certified until the user's Supabase migrations, RLS, RPCs, Vercel deployment, and browser smoke tests pass.

This app runs in two modes:

- **Local** (default) — everything in `localStorage`. Works offline, zero setup.
  Great for trying the app and single-device use. *This is what you have today.*
- **Supabase** (multi-user Intelligence Platform) — a real backend: shared,
  RLS-scoped data, account auth, real-time layout collaboration, object
  storage, and transactional email.

This guide takes you **from zero** (no Supabase environment) to live, and then
maps what is already wired vs. what needs a live project to finish.

---

## Step 1 — Create a Supabase project

1. Go to <https://supabase.com> → **Start your project** → sign in (GitHub or email).
2. **New project**:
   - **Organization**: create one (e.g. "Seven Paths Manor").
   - **Project name**: `wedding-venue-platform`.
   - **Database password**: set one and keep it safe (you'll rarely need it).
   - **Region**: choose the closest to your venues (e.g. `us-east-1` — North Carolina).
   - **Pricing**: the **Free tier** is enough to start.
3. Wait for the project to provision (~1–2 min).

## Step 2 — Apply the database schema

The full schema (tables, Row Level Security, storage buckets, auth trigger,
updated-at triggers) is already in the repo.

**Option A — Supabase CLI (recommended):**
```bash
npm i -D supabase
npx supabase init
npx supabase login
# link to your project
npx supabase link --project-ref <your-project-ref>
# apply the migration
npx supabase db push
```

**Option B — SQL editor (no CLI):**
1. In the dashboard go to **SQL Editor** → **New query**.
2. Paste and run `supabase/migrations/0001_initial.sql` through `0006_platform_tenancy.sql`, one file at a time and in numeric order.
3. Click **Run** after each file and stop if one returns an error. Migration `0006` adds the platform-admin role layer and managed venue-admin onboarding; it must be applied after `0001`–`0005`.

## Step 3 — Configure the app

1. In the dashboard go to **Project Settings → API**.
   Copy **Project URL** and the **anon public key**.
2. Create a `.env.local` file (do **not** commit it) at the repo root:
   ```ini
   # Toggle the platform on
   VITE_BACKEND_PROVIDER=supabase

   # From Supabase → Project Settings → API
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY

   # Optional branding overrides
   VITE_BRANDING_PRIMARY_COLOR=#4A1942
   VITE_SHOW_WELCOME_BY_DEFAULT=true
   ```
3. Run the app:
   ```bash
   npm install
   npm run dev
   ```
4. For the first platform owner, create or confirm the Auth user in Supabase and run the one-time `platform_owner` bootstrap SQL in `docs/platform/MULTI_TENANT_PLATFORM.md`. Platform administrators then use the Platform Admin Console to create venue organizations. Cloud venue users are invitation-only; venue administrators claim a one-time setup link and create their own Auth account.

## Step 4 — (Optional) Transactional email

Email (invitations, RSVP confirmations, staff notifications) uses a Supabase
**Edge Function** that sends via **Resend**.

1. Create a free account at <https://resend.com> and get an **API key** + verify a
   sending domain.
2. In Supabase dashboard → **Edge Functions** → deploy `supabase/functions/send-email`.
   (Or with CLI: `npx supabase functions deploy send-email`.)
3. Set the function secrets (Dashboard → Edge Functions → your function → Secrets,
   or `npx supabase secrets set`):
   ```
   RESEND_API_KEY=re_...
   EMAIL_FROM=Weddings <no-reply@yourdomain.com>
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=service_role_key  # Project Settings → API → service_role
   ALLOWED_ORIGIN=https://your-app.example.com
   ```

---

## Backend seams present in this repo — current status

| Area | Current status | Where |
|---|---|---|
| Platform/venue account bootstrap | ✅ Platform role and venue-admin onboarding code/migration exist; first platform owner still requires one-time SQL bootstrap and live RLS verification. | `platformAdminService`, `PlatformAdminPortal`, `VenueAdminOnboarding`, migration `0006_platform_tenancy.sql` |
| Sign in / session restore / sign out / password reset | ⚠️ Supabase platform-role sign-in/restore exists; email-confirmation and cloud password-reset UX still need hardening. | `AuthBackend`, `AuthContext`, `PasswordReset` |
| Org scope / RLS | ⚠️ Schema exists; owner mapping and broad `org_data` member write policy require remediation and live tests. | `AuthBackend`, migrations `0001`/`0003` |
| Layout persistence | ⚠️ Saved layouts only; current cloud save is organization-wide destructive replace-sync with no safe optimistic revision. | `services/repository/layoutRepository.ts`, `services/sync/layoutSync.ts` |
| Real-time collaboration | ⚠️ Layout-table channel only; entity/couple/operations data is not realtime. | `services/sync/layoutRealtime.ts` |
| Server-side guest portal | ⚠️ Existing public RPCs remain for the legacy portal; new couple snapshot RPCs provide the cross-device invite-link path, pending live-project verification. | `services/portal/guestPortalBackend.ts`, `services/couples/coupleCloudSync.ts`, migrations `0002`/`0005` |
| Object storage for images | ✅ Seam exists and is unit-tested; hosted image references still need live bucket/RLS verification. | `services/storage/*`, `SafeImage`, `MultiImageUpload` |
| Entity repository | ⚠️ Extended to mirror business domains and hydrate on `org_data` Realtime changes; pending live RLS verification. | `services/repository/entityRepository.ts`, `services/sync/*`, migration `0003_org_data.sql` |
| Couple/guest cross-device snapshots | ⚠️ Code and migration path added; requires `0005` plus a live Supabase project. | `services/couples/coupleCloudSync.ts`, `GuestPortal.tsx`, `CouplesPortal.tsx` |
| Multi-org/venue invites | ⚠️ Existing organization invite UI remains available for venue admins; the acceptance RPC is hardened by `0006`, while the active AuthContext refresh and cloud email delivery still require live testing. | `services/org/inviteService.ts`, `InviteMembers`, `AcceptInvite`, migration `0004_invites.sql`/`0006_platform_tenancy.sql` |
| DB schema / storage buckets / Edge Function | ⚠️ Migrations now include platform tenancy (`0006`); no live project/RLS/Resend certification has been run. | `supabase/migrations/*`, `supabase/functions/send-email/` |

## What still needs a live project (just apply migrations + test)

The backend seams are unit-tested against mocks, but they are **not a substitute for a live RLS/integration test**. Final verification requires running against your real project (paste your URL + anon key), applying all migrations, and completing the live smoke test in Review #175. In particular, do not assume cross-device couple/guest sharing is live until the Supabase project passes the device-A/device-B/device-C workflow.

The remaining migration/application checklist is:

1. **`0002_guest_portal.sql`** — secure public guest portal (token-verified identity and RSVP RPCs).
2. **`0003_org_data.sql`** — generic organization-scoped catalog/asset key-value store.
3. **`0004_invites.sql`** — venue organization invites + accept-invite RPC.
4. **`0005_couple_portal_sync.sql`** — cross-device couple snapshots and couple/guest RSVP synchronization.
5. **`0006_platform_tenancy.sql`** — platform roles, tenant metadata access, venue creation, managed-admin onboarding, and hardened organization invite acceptance.

Apply all six (`supabase db push`, or paste each into the SQL editor) only in a non-production test project first. Then bootstrap the first `platform_owner` using the SQL in `docs/platform/MULTI_TENANT_PLATFORM.md`. Setting `VITE_BACKEND_PROVIDER=supabase` turns on the available seams, but it does not make every local couple/guest/operations workflow cloud-backed. Complete the platform-owner → managed-admin → tenant-isolation → couple/guest browser smoke test before migrating real venue data.

---

## Architecture (how it fits together)

```
React app (useLayoutState holds in-memory state)
   │
   ├─ LOCAL mode ──► LocalLayoutRepository ──► localStorage
   │
   └─ SUPABASE mode ─► AuthContext ─► Supabase Auth (sign in / register / session)
                       │
                       └─ LayoutRepository ─► supabase-js ─► Postgres
                            (RLS-scoped by organization)
                                 │
                                 ├─ Realtime (layouts channel) → live sync
                                 ├─ ObjectStorageService → private buckets
                                 └─ send-email Edge Function (Resend)
```

**Multi-tenancy** is enforced by Row-Level Security: every user belongs to one or
more `organizations` via `organization_memberships`, and every table row carries
`organization_id`. RLS policies grant access only to members of that org (plus
event-members for guests), so a venue can never see another venue's data.

---

## Checklist before you go live
- [ ] Supabase project created
- [ ] Migrations `0001` through `0006` applied in order
- [ ] First Auth user inserted into `platform_memberships` as `platform_owner`
- [ ] Vercel variables set: `VITE_BACKEND_PROVIDER=supabase`, URL, and public key
- [ ] Platform Admin Console creates a test venue organization
- [ ] Managed venue administrator claims the setup link and can open Admin Settings
- [ ] Venue admin can invite an internal planner/staff user through **Admin → Invite Members**
- [ ] Tenant isolation smoke test passes
- [ ] Couple/guest cross-device smoke test passes
- [ ] (Optional) Email Edge Function deployed + secrets set
- [ ] MFA enabled for platform owners/admins before production
- [ ] Vercel production domain added to Supabase Auth URL configuration
