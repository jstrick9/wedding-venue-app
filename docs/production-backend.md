# Production Backend

This directory contains documentation for the optional production-grade backend.

- `.env.example` — Environment variable template
- `supabase/migrations/` — Database schema (Postgres / Supabase)
- `supabase/functions/send-email/` — Edge function for transactional email
- `src/services/backend/` — Auth backend (`AuthBackend.ts`) and other server-side services
- `src/services/storage/` — Object storage service (`ObjectStorageService.ts`)

Note: The default application uses `localStorage` via `useLayoutState`. The production backend code is included but not active unless `VITE_BACKEND_PROVIDER='supabase'` is configured.
