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
setup — best for trying it and single-device use). It contains a **partial
Supabase backend seam** for account auth, saved-layout sync, business-domain
mirroring, cross-device couple snapshots, guest RSVP RPCs, object storage,
invites, and transactional email. The cross-device path requires migrations
`0001`–`0005` and a live Supabase project; it is not yet live-verified for
production. Review
`docs/reviews/173-comprehensive-platform-code-and-domain-audit-2026-08-18.md`
before enabling it with real venue data.

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
