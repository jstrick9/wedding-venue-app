# Review #238 — Forced password change must not hang

The first-login **Set a New Password** gate awaited `changePassword` with
no deadline and no `finally`. If hashing stalled or threw, **Updating…**
never cleared. Sign In already timed out at 20s (#227); this gate did not.

## 1. What changed

- Update Password times out at **20s**
- Timeout or throw shows the error on the form and re-enables
  **Update Password** (`try/finally`)
- Source-scan hang coverage includes the forced-change timeout

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Sign in with an account that must change its password
3. If the update stalls, you leave Updating… after 20s and can retry

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **955 passed / 5 skipped** |
| `npm run build` | Pass — **2,329.17 kB / 556.31 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #238.*
