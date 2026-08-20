# Review #185 — Geoapify address quality + contact validation

**Repository:** `jstrick9/wedding-venue-intelligence-platform`  **Date:** 2026-08-19
**Scope:** Replace Nominatim with Geoapify for address autocomplete, verification,
and platform map tiles. Add shared US contact-quality checks (phone, email,
website, ZIP, state) and wire them across venue/platform forms and other
contact save paths. Runtime code, SQL, and regression tests were changed. Live
Supabase/Geoapify smoke tests remain pending.

User-selected decisions (do not re-ask):

| Decision | Choice |
|---|---|
| Address provider | Geoapify (replace Nominatim) for autocomplete + geocoding + platform map tiles |
| Address screens | Platform onboard + venue detail. Venue-admin settings validate contact fields only; mailing address stays platform-only |
| Strictness | Must verify; overwrite city/state/ZIP from the selected street result; line 2 stays free |
| Validation | Shared helpers, app-wide on save/blur |
| Contact rules | US NANP + syntax only (no live MX / HTTP HEAD) |
| API key | Server proxy only. `GEOAPIFY_API_KEY` is an Edge Function secret |

Geoapify is **not** USPS CASS. City/state/ZIP still cannot be mistyped because
they are filled from the selected suggestion, but they are Geoapify/OSM
components, not official USPS delivery-point records.

---

## 1. What was added

| Item | Change | Validation |
|---|---|---|
| Shared contact quality | `src/utils/contactQuality.ts` — email lowercase/syntax, US phone `+1` / `(555) 123-4567`, http(s) website, ZIP, US state codes | Unit tests |
| Geoapify mapping | `src/utils/geoapifyAddress.ts` — street line from housenumber+street; city-only / street-only results are not verified | Unit tests |
| Edge Function | `geocode-venue` now proxies Geoapify `autocomplete`, `verify`, and `tile`. Nominatim and the 1.1s rate slot are gone. Platform-admin auth still required. Key never sent to the browser | Service tests (mocked fetch) |
| Autocomplete UI | `AddressAutocomplete` on onboard + venue detail. City/state/ZIP are read-only. Save blocked until a verified street is selected (or the stored address is unchanged) | Component test + portal save-without-regeocode test |
| Platform map | Leaflet + Geoapify tiles through the same Edge Function when Supabase is configured; schematic SVG fallback otherwise. Floor-plan designer unchanged | Geometry unit tests; portal still stubs the map |
| Service layer | `createVenueOrganization` / `updateVenueOrganization` normalize phone/email/website and reject invalid values before the RPC | Service tests |
| SQL | Migration `0014` tags new coordinates `geocode_provider = 'geoapify'` | Reviewed SQL |
| App-wide contact checks | Branding settings (blur), Admin user create, Invite Members, Vendor panel, Couples guests/vendors/invites, Guest RSVP, GuestPanel edit | Existing form tests + new helpers |

**Still deferred:** Phase 3 venue-intelligence features; N-3 hash-only tokens in
`couple_portal_snapshots.payload`; remaining `@ts-nocheck`; 5 skipped tests;
live RLS / Geoapify smoke (no project in this workspace).

---

## 2. Live follow-up

After this ships, in the Supabase project (click-by-click in
`docs/platform/MULTI_TENANT_PLATFORM.md` → “Geoapify address lookup”):

1. Apply migrations `0001`–`0014`.
2. Dashboard → **Edge Functions → Secrets** → add `GEOAPIFY_API_KEY` (never Vercel / Vite).
3. `npx supabase functions deploy geocode-venue` so the live function is the Geoapify proxy. A missing function shows as browser **Failed to fetch**.
4. Smoke: onboard a venue by picking a suggestion — city/state/ZIP fill, platform map shows a tile pin, platform login stays navy, new-venue login stays charcoal until branding is saved.

---

## 3. Validation

Re-run against HEAD after this change. Live SQL/RLS/Geoapify: **not executed**.

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **820 passed / 5 skipped** (was 807 / 5) |
| `npm run build` | Pass — 2,279.36 kB / 541.77 kB gzip (Leaflet + Geoapify tile client) |
| `VITE_SPLIT=1 npm run build` | Pass — Leaflet in its own ~150 kB / 43 kB gzip chunk |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #185.*
