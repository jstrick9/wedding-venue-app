# wedding-venue-app

A React/Vite wedding venue planning and layout application with optional Supabase production backend support.

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run typecheck
npm test -- --run
npm run build
```

## Production backend (Intelligence Platform)

The app runs in **Local** mode by default (all data in `localStorage`, zero
setup — best for trying it and single-device use). It can be switched to a
**Supabase multi-user Intelligence Platform** with shared, RLS-scoped data,
account auth, real-time layout collaboration, object storage, and transactional
email.

**Follow `docs/platform/PLATFORM.md` to go live from scratch** (create a Supabase
project, apply the migration, configure `.env.local`, and see what's wired vs.
what remains).

Platform code lives under:
- `supabase/migrations/` — Postgres schema + Row-Level Security + storage buckets
- `supabase/functions/send-email/` — transactional email Edge Function (Resend)
- `src/services/backend/` — Supabase auth backend (sign in / register / session)
- `src/services/platform.ts` — runtime provider detection (local vs supabase)
- `src/services/repository/` — data-persistence seam (local + Supabase providers)
- `src/services/storage/` — object storage service
- `docs/production-backend.md` — earlier backend notes

Never commit real credentials. Configure Supabase, email, and deployment secrets through your hosting provider or the Supabase CLI.
