# Going Live: Turning the app into a true Intelligence Platform (Supabase)

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

## What is already wired (verified in this repo)

| Area | Status | Where |
|---|---|---|
| Account registration + org bootstrap | ✅ Built + tested | `AuthBackend.signUpWithSupabase`, `AuthContext.register`, LoginScreen sign-up |
| Sign in / session restore / sign out / password reset | ✅ Built | `AuthBackend` (existing) |
| Org scope (RLS) in auth/session | ✅ Built + tested | `AuthBackend` / `AuthContext.organizationId` |
| Data persistence seam (local + Supabase providers) | ✅ Built + tested | `services/repository/layoutRepository.ts`, `services/platform.ts` |
| Layout sync wired into the app UI | ✅ Built + tested | `services/sync/layoutSync.ts`, `hooks/useLayoutBackendSync.ts` |
| Real-time layout collaboration | ✅ Built + tested | `services/sync/layoutRealtime.ts` |
| Server-side guest portal (identity + RSVP) | ✅ Built + tested | `services/portal/guestPortalBackend.ts`, migration `0002_guest_portal.sql` |
| Object storage for images | ✅ Built + tested | `services/storage/imageStorage.ts`, `SafeImage`, `MultiImageUpload` |
| Entity repository (venues/decor/vendors/staff/settings) | ✅ Built + tested | `services/repository/entityRepository.ts`, `services/sync/entitySync.ts`, migration `0003_org_data.sql` |
| DB schema + Row-Level Security + storage buckets | ✅ Ready (migration) | `supabase/migrations/0001_initial.sql` |
| Transactional email Edge Function | ✅ Ready | `supabase/functions/send-email/` |
| Object storage service | ✅ Ready | `services/storage/ObjectStorageService.ts` |

## What still needs a live project to finish (next milestones)

The code for layout persistence + real-time sync is **built and unit-tested**
against mocks, but final verification requires running against your real
project (paste your URL + anon key). Remaining milestones:

1. **Apply migration `0002_guest_portal.sql`** — enables the secure public guest
   portal (token-verified identity RPC + RSVP RPC). Already coded + unit-tested;
   just run the migration against your project.
2. **Multi-org invites** — use the email Edge Function to invite staff/planners
   into an organization (the `organization_memberships` + `invitation` tables).

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
