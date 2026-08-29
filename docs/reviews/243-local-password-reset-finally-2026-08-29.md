# Review #243 — Local password reset must not hang

Cloud forgot-password send already times out at 20s (#227). The local
(demo) send, resend, and reset paths hashed the code/password with no
`try/finally`. If Web Crypto threw, **Sending Code…** / **Updating...**
never cleared.

## 1. What changed

- Local send, resend, and reset wrap hashing in `try/catch/finally`
- Cloud send stays on the same 20s timeout; empty email still returns
  through `finally`
- Throw shows the error and re-enables the button

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Local-mode Reset Password: if hashing fails, you leave Sending Code…
   / Updating... and can retry
3. Cloud reset is unchanged (email link + `/reset/platform` or
   `/reset/venue`)

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **971 passed / 5 skipped** |
| `npm run build` | Pass — **2,331.02 kB / 556.53 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #243.*
