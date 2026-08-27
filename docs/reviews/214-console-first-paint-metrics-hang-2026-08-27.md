# Review #214 — Console first paint must not wait on metrics

#212/#213 stopped Save/reissue/suspend from waiting on
`get_platform_console_metrics`. Opening the console and clicking
**Refresh** still used `Promise.all` with that RPC. When metrics stall
(they scan `org_data` for active venues), the directory never appears.

## 1. What changed

- First load waits only on the venue list
- Branding, metrics, and audit fill in the background
- **Refresh** uses the same non-blocking path (no full-page spinner)
- Overview **Venues / Active / Suspended** counts come from the loaded
  list so they are not stuck at 0 while metrics catch up

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Overview and **Venues** should show tenant cards even if couple/guest
   KPI numbers take longer
3. **Refresh** should not blank the directory

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **894 passed / 5 skipped** |
| `npm run build` | Pass — **2,317.94 kB / 554.30 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #214.*
