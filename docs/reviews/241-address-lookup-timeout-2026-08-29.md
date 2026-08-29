# Review #241 — Address lookup must not hang

Onboard and venue-edit street typeahead awaited Geoapify with no
deadline. If the Edge Function stalled, **Looking up addresses…** never
cleared. Create Venue already times out geocode at 15s (#222); the
suggestion fetch did not.

## 1. What changed

- Street autocomplete times out at **15s**
- Timeout or throw shows the error and clears **Looking up addresses…**
  (`finally`)

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Onboard venue or edit address and start typing a US street
3. If lookup stalls, you leave Looking up addresses… after 15s and can
   type again

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **966 passed / 5 skipped** |
| `npm run build` | Pass — **2,330.64 kB / 556.49 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #241.*
