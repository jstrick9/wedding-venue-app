# Review #217 — Path-only password reset with a dual-session recovery page

Forgot password on Platform / venue login called
`resetPasswordForEmail` with `redirectTo=…#/password-reset`. That hash is
stripped by mail clients (same class of bug as invite `?va=`). App had no
recovery route, and both Supabase clients set `detectSessionInUrl: false`
so a recovery `?code=` was never exchanged onto `wvip-auth-platform` or
`wvip-auth-venue`.

## 1. What changed

- Reset emails redirect to **`/reset/platform`** or **`/reset/venue`**
  (no `?` or `#` in `redirectTo`)
- `vercel.json` rewrites those paths to `index.html`
- A public recovery screen exchanges the PKCE code (or implicit tokens)
  on the matching surface client, then `updateUser({ password })`
- Platform vs venue Forgot password uses that surface’s client so PKCE
  and dual sessions stay aligned
- Sign-out will not steal `/reset/…`

## 2. Operator

1. Hard-refresh after the Vercel deploy (rewrite must be live)
2. In **Supabase → Authentication → URL configuration**, allow
   `https://weddingvip.vercel.app/reset/platform` and
   `https://weddingvip.vercel.app/reset/venue` (or a `/**` redirect
   pattern if the project already uses one)
3. Platform login → Forgot password → open the newest email **in the
   same browser** → set a new password → you should land on the console
4. Venue login → Forgot password uses `/reset/venue` and does not replace
   the platform session

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **906 passed / 5 skipped** |
| `npm run build` | Pass — **2,323.87 kB / 555.34 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #217.*
