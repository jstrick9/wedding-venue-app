# Review #237 — Creating a staff invite account must not hang

`#/accept-invite/…` Create Account awaited `register` with no deadline
and no `finally`. If Auth stalled or threw, **Creating account…** never
cleared. Sign In already timed out at 20s (#227); sign-up did not.

## 1. What changed

- Create Account times out at **20s**
- Timeout or throw shows the error on the form and re-enables
  **Create Account** (`try/finally`)
- Source-scan hang coverage includes the signup timeout

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Open a staff `#/accept-invite/…` link and use Create Account
3. If Auth stalls, you leave Creating account… after 20s and can retry

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **952 passed / 5 skipped** |
| `npm run build` | Pass — **2,329.00 kB / 556.28 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #237.*
