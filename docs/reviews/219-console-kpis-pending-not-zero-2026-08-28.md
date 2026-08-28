# Review #219 — Console KPIs must not show 0 while metrics are pending

#214 stopped first paint from waiting on `get_platform_console_metrics`.
Venue / Active / Suspended then came from the organization list, but
**Managed admins / Couples / Guests / RSVPs** still initialized at 0.
While that RPC scans `org_data` (or never returns), operators read those
zeros as real counts.

## 1. What changed

- **Managed admins** is counted from the loaded venue admin list
- **Couples / Guests / RSVPs** show **—** until metrics succeed (overview
  KPIs, directory cards, and venue detail)
- Real zeros still appear after metrics return

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Overview should show venue/admin counts immediately
3. Couples / Guests / RSVPs should be **—**, not 0, until those numbers
   fill in
4. Directory cards should not say Couples: 0 while metrics are still
   loading

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **911 passed / 5 skipped** |
| `npm run build` | Pass — **2,324.21 kB / 555.38 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #219.*
