# Review #186 — Unblock live Geoapify address lookup

**Repository:** `jstrick9/wedding-venue-intelligence-platform`  **Date:** 2026-08-19
**Scope:** Venue Detail street autocomplete showed the browser's raw
`Failed to fetch`. That is a network/CORS miss — almost always because
`geocode-venue` was not deployed after #185 — not a Geoapify key typo.

## 1. What changed

| Item | Change | Validation |
|---|---|---|
| Client | Translate `Failed to fetch` / `NetworkError` into a deploy-the-function message | Service test |
| Edge Function | CORS now reflects the request `Origin` so a mismatched `ALLOWED_ORIGIN` cannot hide the real error | Reviewed function |
| Docs | Click-by-click secret + deploy steps in `MULTI_TENANT_PLATFORM.md` | Review |

The API key still never ships to the browser. Secrets stay in the Supabase
Edge Function secret store only.

## 2. Live follow-up (unchanged from #185, more explicit)

1. Apply `0014` if needed.
2. Set `GEOAPIFY_API_KEY` under Edge Functions → Secrets.
3. Deploy `geocode-venue`.
4. Hard-refresh and type a US street on Venue Detail / Onboard.

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **821 passed / 5 skipped** (was 820 / 5) |
| `npm run build` | Pass — 2,279.72 kB / 541.94 kB gzip |
| `VITE_SPLIT=1 npm run build` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

Live SQL/Geoapify: **not executed**.

---

*End of Review #186.*
