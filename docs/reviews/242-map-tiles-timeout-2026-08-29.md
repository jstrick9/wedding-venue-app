# Review #242 — Map tiles must not hang

Console Map (`#/platform-admin/map`) awaited Geoapify tiles with no
deadline. If the `geocode-venue` Edge Function stalled, Leaflet
`createTile` never called `done()`, so the map stayed blank. Street
autocomplete already times out at 15s (#241); tile fetch did not.

## 1. What changed

- `fetchGeoapifyTile` times out at **15s** (token lookup, Edge fetch,
  and blob decode)
- Timeout or throw surfaces **Loading map tiles timed out…** via the
  existing `tileError` banner; Leaflet `done()` still runs in `catch`

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Open Platform console → Map
3. If tiles stall, the amber error appears after 15s instead of a blank
   map. Sign in again at Platform login if this keeps happening

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **969 passed / 5 skipped** |
| `npm run build` | Pass — **2,330.74 kB / 556.52 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #242.*
