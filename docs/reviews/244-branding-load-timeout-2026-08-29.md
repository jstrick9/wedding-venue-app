# Review #244 — Branding load must not hang

Console first paint already skips metrics (#214). Branding, metrics, and
audit still loaded in the background with no deadline. If
`getPlatformBranding` stalled, **Save Platform Branding** stayed enabled
on default navy and could overwrite live invite templates.

## 1. What changed

- Branding, metrics, and audit time out at **20s**
- Save and logo upload stay disabled until branding loads
  (**Loading branding…**)
- Timeout or throw shows the error and **Try again**; Save stays blocked
  so defaults cannot overwrite live branding

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Open Platform console → Branding
3. If branding stalls, Save stays on Loading branding… then shows an
   error after 20s. Use Try again or Refresh. Do not save until the
   live templates appear

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **973 passed / 5 skipped** |
| `npm run build` | Pass — **2,331.80 kB / 556.74 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #244.*
