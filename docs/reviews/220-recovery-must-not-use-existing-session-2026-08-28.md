# Review #220 — Password recovery must not use an existing session

`/reset/platform` without a `?code=` (bookmark, stripped mail link, or
typed URL) still showed **Set a new password**. Submit called
`getSession()` and, if a platform/venue login was already in this
browser, `updateUser({ password })` changed **that** account instead of
requiring the emailed recovery token.

## 1. What changed

- Recovery updates a password only after a PKCE `code` or implicit
  access/refresh tokens from the reset email
- An already-signed-in session is not treated as recovery proof
- The form is hidden when the link has no recovery token; the operator
  sees the missing-link error immediately

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Open `/reset/platform` while signed in at Platform login — you should
   **not** get a password form
3. Use Forgot password, open the newest email **in the same browser**,
   then set the new password

Keep `https://weddingvip.vercel.app/reset/platform` and
`/reset/venue` on the Supabase Auth redirect allow list (#217).

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **913 passed / 5 skipped** |
| `npm run build` | Pass — **2,324.38 kB / 555.42 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #220.*
