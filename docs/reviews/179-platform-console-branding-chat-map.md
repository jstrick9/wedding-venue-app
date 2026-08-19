# Review #179 — Platform Console Branding, Venue Chat, Required Contact/Location, and Map Operations

**Date:** 2026-08-19
**Status:** Implemented in code and migrations; live Supabase/Edge Function validation pending

## User-approved scope

- Remove the platform/venue login `OR` divider.
- Give venue login pages configurable branding backgrounds, logo, message, and reduced-motion-safe animation.
- Give the platform owner independent platform branding.
- Add platform↔venue chat, one RLS-scoped thread per venue.
- Require venue address and primary contact name/phone/email during platform onboarding.
- Use server-side Nominatim geocoding with caching and attribution.
- Add point, density, region/choropleth-style, and table-backed venue maps.
- Keep the platform console tenant-directory/health operations model suitable for hundreds of venues.

## Changes

### Login branding

- Removed the visual `OR` divider from login screens.
- `LoginScreen` now renders configured solid, gradient, pattern, or animated backgrounds.
- Supported patterns: dots, grid, diagonal, confetti.
- Supported motion: drift, shimmer, float, and none.
- `prefers-reduced-motion` disables login animation.
- Login welcome message and overlay opacity are configurable.
- `Logo` continues to use the uploaded logo URL; the fallback mark is only used when no usable logo exists.

### Platform branding

- `platform_settings` stores a platform-global `Config` separate from every venue.
- `get_public_platform_branding()` safely supplies platform login branding.
- Platform Admin Console includes platform name, tagline, message, logo upload, colors, background mode, pattern, and animation controls.
- `public-branding` Storage bucket supports intentionally public branding assets.

### Venue branding

- Venue login continues to read safe branding through `get_public_venue_branding(slug)`.
- Existing venue Admin → Branding settings now include Login Page Experience controls.
- Supabase-mode main venue logo uploads use the public branding bucket; local mode remains data-URL compatible.

### Platform↔venue chat

- `platform_venue_messages` is organization-scoped and RLS-protected.
- Platform admins can chat with a specific venue.
- Active venue members can use the Platform Chat admin tab.
- Realtime insert subscriptions have polling fallback.
- Couple chat and guest portals remain separate.

### Address/contact/geocoding

- Venue creation requires address line 1, city, state/region, postal code, country, primary contact name, phone, and email.
- `create_venue_organization_v2` stores normalized location/contact fields and coordinates.
- `geocode-venue` Edge Function verifies platform-admin Auth, uses a descriptive User-Agent/Referer, checks/updates a cache, and queries Nominatim only on deliberate setup requests.
- The UI displays OSM attribution and does not implement autocomplete.

### Venue maps

The platform console now includes:

- point map for geocoded venues;
- density grid for operational concentration;
- region/choropleth-style view for state/region counts;
- accessible table with exact venue/status/coordinate values;
- selected-venue detail card.

A true GeoJSON state/county boundary layer can replace the region tiles without changing the metrics contract.

## Research constraints

Nominatim's public server has a strict maximum of one request per second, requires an identifying User-Agent/Referer, discourages heavy/bulk geocoding, requires caching, and requires OSM attribution. For hundreds of venues, use a self-hosted/managed Nominatim instance or a commercial provider before high-volume onboarding. See the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).

The console follows OWASP tenant context/isolation guidance, Supabase RLS/database testing guidance, and accessible map/table principles. See `docs/platform/PLATFORM_CONSOLE_OPERATING_MODEL.md`.

## Live setup required

Apply migrations `0009_platform_branding_chat_and_venue_location.sql` after `0001`–`0008`.
Deploy the `geocode-venue` Edge Function with:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
PUBLIC_APP_URL
ALLOWED_ORIGIN
```

The service-role key belongs only in Supabase Edge Function secrets—not Vercel client variables and not GitHub.

## Validation

- TypeScript/typecheck and production build pass during implementation checkpoints.
- Existing full suite remains the regression baseline; the final console changes require another complete test/coverage run before commit.
- Live RLS, storage, Nominatim Edge Function, chat, map, and cross-tenant isolation tests remain pending until a temporary live-test configuration is provided.
