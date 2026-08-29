# Review #227 — Staff login and password reset must not hang

Platform Sign In awaited Auth with no deadline and no `try/finally`. A
stalled `signInWithPassword` (or a thrown network error) left the button
on **Signing in…** forever. Forgot-password send and `/reset/…` save had
the same class of hang.

## 1. What changed

- Sign In times out at **20s** and always clears the busy state
- A thrown login error shows the message instead of a stuck button
- Forgot-password send times out at **20s**
- Recovery save times out at **20s**

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Sign In should not stay on Signing in… if Auth stalls — you get a
   timeout and can try again
3. Forgot password and `/reset/platform` / `/reset/venue` should time
   out the same way instead of spinning forever

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **927 passed / 5 skipped** |
| `npm run build` | Pass — **2,326.30 kB / 555.79 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #227.*
