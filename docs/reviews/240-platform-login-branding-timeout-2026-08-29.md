# Review #240 — Platform login branding must not hang

`#/platform-login` hydrates `get_public_platform_branding` in the
background with no deadline. Sign In already paints (unlike venue
login #233), but a stalled RPC never applied saved platform chrome
and an uncaught throw was possible.

## 1. What changed

- Public platform branding times out at **20s**
- Timeout or throw keeps default navy; Sign In stays visible
- The branding fetch is cancelled if the login screen unmounts

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Open `#/platform-login` — Sign In is immediate
3. Saved platform branding still applies when the RPC returns in time

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **963 passed / 5 skipped** |
| `npm run build` | Pass — **2,330.56 kB / 556.47 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #240.*
