# Going Live: Turning the app into a true Intelligence Platform (Supabase)

> **Audit status (2026-08-18):** This document describes the intended Supabase architecture, not a completed production certification. Review #173 found that owner-membership bootstrap/RLS, role mapping, public guest RSVP RPC behavior, couple/guest data projection, generic `org_data` authorization, entity hydration, and destructive layout sync must be fixed and tested against a live project before enabling this mode for real venue data. See `docs/reviews/173-comprehensive-platform-code-and-domain-audit-2026-08-18.md`.

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
2. Paste the entire contents of `supabase/migrations/0001_initial.sql`.
3. Click **Run**. You should see no errors (the migration is idempotent —
   it uses `create table if not exists`).

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
4. On the login screen you'll now see **"Create a new account"** — register a
   new account. That creates your auth user + a personal organization scope, and
   you're logged into the platform. (Local demo accounts are disabled in this mode.)

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
| Account registration + org bootstrap | ⚠️ Code exists, but initial owner membership is rejected by current RLS and the client ignores the error. | `AuthBackend.signUpWithSupabase`, migration `0001_initial.sql` |
| Sign in / session restore / sign out / password reset | ⚠️ Supabase sign-in/restore exists; visible forgot-password UI is still local-only. | `AuthBackend`, `AuthContext`, `PasswordReset` |
| Org scope / RLS | ⚠️ Schema exists; owner mapping and broad `org_data` member write policy require remediation and live tests. | `AuthBackend`, migrations `0001`/`0003` |
| Layout persistence | ⚠️ Saved layouts only; current cloud save is organization-wide destructive replace-sync with no safe optimistic revision. | `services/repository/layoutRepository.ts`, `services/sync/layoutSync.ts` |
| Real-time collaboration | ⚠️ Layout-table channel only; entity/couple/operations data is not realtime. | `services/sync/layoutRealtime.ts` |
| Server-side guest portal | ⚠️ Existing public RPCs remain for the legacy portal; new couple snapshot RPCs provide the cross-device invite-link path, pending live-project verification. | `services/portal/guestPortalBackend.ts`, `services/couples/coupleCloudSync.ts`, migrations `0002`/`0005` |
| Object storage for images | ✅ Seam exists and is unit-tested; hosted image references still need live bucket/RLS verification. | `services/storage/*`, `SafeImage`, `MultiImageUpload` |
| Entity repository | ⚠️ Extended to mirror business domains and hydrate on `org_data` Realtime changes; pending live RLS verification. | `services/repository/entityRepository.ts`, `services/sync/*`, migration `0003_org_data.sql` |
| Couple/guest cross-device snapshots | ⚠️ Code and migration path added; requires `0005` plus a live Supabase project. | `services/couples/coupleCloudSync.ts`, `GuestPortal.tsx`, `CouplesPortal.tsx` |
| Multi-org invites | ⚠️ RPC and UI exist; acceptance does not refresh active AuthContext and invite email binding is not enforced. | `services/org/inviteService.ts`, `InviteMembers`, `AcceptInvite`, migration `0004_invites.sql` |
| DB schema / storage buckets / Edge Function | ⚠️ Migration and function code exist; no live project/RLS/Resend certification has been run. | `supabase/migrations/*`, `supabase/functions/send-email/` |

## What still needs a live project (just apply migrations + test)

The backend seams are unit-tested against mocks, but they are **not a substitute for a live RLS/integration test**. Final verification requires running against your real project (paste your URL + anon key), applying all migrations, and completing the live smoke test in Review #175. In particular, do not assume cross-device couple/guest sharing is live until the Supabase project passes the device-A/device-B/device-C workflow.

The remaining migration/application checklist is:

1. **`0002_guest_portal.sql`** — secure public guest portal (token-verified
   identity RPC + RSVP RPC).
2. **`0003_org_data.sql`** — generic org-scoped catalog/asset key-value store.
3. **`0004_invites.sql`** — organization invites + accept-invite RPC.
4. **`0005_couple_portal_sync.sql`** — cross-device couple snapshots, token-validated couple access, guest portal hydration, and guest RSVP writes.

Apply all five (`supabase db push`, or paste each into the SQL editor) only in a
non-production test project first. Setting `VITE_BACKEND_PROVIDER=supabase` turns
on the available seams, but it does not make every local couple/guest/operations
workflow cloud-backed. Complete Review #173's P0/P1 work and a live RLS/browser
smoke test before migrating real venue data.

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
- [ ] `supabase/migrations/0001_initial.sql` applied
- [ ] `.env.local` set with `VITE_BACKEND_PROVIDER=supabase` + URL + anon key
- [ ] App runs, you can register an account and see the workspace
- [ ] (Optional) Email Edge Function deployed + secrets set
- [ ] Decide hosting (Netlify/Vercel static, or `npm run build:split` for
      code-split) — see `vite.config.ts` build notes
