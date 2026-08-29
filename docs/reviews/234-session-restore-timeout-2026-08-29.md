# Review #234 — Session restore must not hang boot

Cloud mode awaited `migrateLegacyAuthSessions` plus platform and venue
`restoreSupabaseSession` with no deadline. AuthProvider does not render
children until that finishes, so a stalled `getSession` left the whole
app — including `#/venue-login/<slug>` — on **Loading...**.

## 1. What changed

- Boot restore (legacy migrate + both surfaces) times out at **20s**
- Timeout or throw still calls `setInitialized(true)` so login can paint
- Timed-out restore is treated as signed-out (JWT stays in storage for
  the next load)

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Opening venue login or platform login should not stay on Loading...
   if Auth restore stalls — the sign-in form appears after 20s
3. Sign in again if the previous session did not restore in time

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **944 passed / 5 skipped** |
| `npm run build` | Pass — **2,328.24 kB / 556.14 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #234.*
