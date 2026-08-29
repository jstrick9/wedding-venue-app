# Review #223 — Venue list must not hang first paint

#214 stopped first paint from waiting on `get_platform_console_metrics`,
but `loadConsole` still awaited `listPlatformOrganizations` before starting
metrics/branding/audit. If that four-query list stalls, the console never
hydrates KPIs and Overview Venues/Active/Awaiting/Suspended/Pending/
Managed admins stay at **0**. #219 already used **—** for Couples/Guests/
RSVPs; list-derived cards had the same hole.

## 1. What changed

- Organization list load times out at **20s** (same for Refresh)
- Metrics, branding, and audit start immediately — they no longer wait
  on the venue list
- List-derived overview KPIs show **—** until the list succeeds
- Real zeros still appear after the list returns

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Overview should not flash **0** venues while the directory is still
   loading
3. Couples / Guests / RSVPs can fill in even if the venue list is slow
4. If the list hangs, you should get a timeout error instead of a stuck
   Loading venue organizations… state. Sign in again at Platform login
   if it keeps happening

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **919 passed / 5 skipped** |
| `npm run build` | Pass — **2,324.91 kB / 555.56 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #223.*
