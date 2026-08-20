# Wedding Venue Intelligence Platform

A React/Vite wedding venue planning, layout, and guest-management application with an optional Supabase multi-tenant production backend.

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run typecheck      # tsc --noEmit
npm run lint:events    # typed event-bus linter
npm run lint           # ESLint
npm run test           # vitest
npm run build          # single-file bundle
```

The CI workflow (`.github/workflows/ci.yml`) enforces all of the above plus a
strict unused-locals scan, the code-split build, and a production-only dependency
audit.

## Product & architecture

- **Local mode (default):** all data in `localStorage`, zero setup, single-browser/
  single-device use. Offline-capable core.
- **Supabase mode (`VITE_BACKEND_PROVIDER=supabase`):** an optional multi-tenant
  backend with:
  - platform console (`#/platform-admin`, `#/platform-login`) and venue-specific
    login (`#/venue-login/<slug>`) with public venue branding;
  - organization-level tenant isolation with lifecycle (`provisioning` / `active` /
    `suspended` / `archived`), managed venue-administrator onboarding invites, and
    audited platform actions;
  - cross-device couple/guest portal snapshots, platform↔venue chat, venue
    address/contact + server-side Geoapify autocomplete, verification, and map
    tiles (API key never ships to the browser), and object storage for public branding.
  - Migrations live in `supabase/migrations/` (`0001`–`0014`). Apply them in order
    and run a live RLS/onboarding smoke test before trusting cloud mode with real
    venue data. The geocode Edge Function requires
    `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_APP_URL`, `ALLOWED_ORIGIN`,
    and `GEOAPIFY_API_KEY` as server secrets (the service-role and Geoapify keys
    must never go into Vercel/client env or GitHub).

> **Honesty boundary:** local mode is the exercised product mode today. In cloud
> mode the catalog/design domains and couple/guest snapshots are mirrored, but not
> every workflow is a server-side source of truth yet — see
> `docs/AI_AGENT_MEMORY.md` §9 and `docs/reviews/180-deep-audit-2026-08-19.md`.

Platform code lives under:
- `supabase/migrations/` — Postgres schema + Row-Level Security + storage buckets
- `supabase/functions/geocode-venue/` — server-side geocoding Edge Function
- `supabase/functions/send-email/` — transactional email Edge Function
- `src/services/backend/` — Supabase auth backend
- `src/services/platform/` — platform console / tenant / chat / branding / geocoding
- `src/services/repository/` — data-persistence seam (local + Supabase providers)
- `src/services/storage/` — object storage service

Never commit real credentials. Put `GEOAPIFY_API_KEY` only in Supabase Edge
Function secrets. Put the GitHub Action token/project ref only in GitHub
Actions secrets. Never put service-role or Geoapify keys in Vercel.
