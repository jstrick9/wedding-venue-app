# Review #218 — Failed login must not leave a stray JWT

A valid password at **venue login** for the wrong venue (or a suspended
venue) still called `signInWithPassword` on `wvip-auth-venue`. The
function then returned `null` **without signing out**, so the venue
client kept that JWT while React kept the previous `venueAuth` (or none).

The same class of miss existed on **Platform login**: a venue-only
account with a valid password created a platform-client session, then
`signOut()` used the default **global** scope, which can revoke that
user’s venue refresh token.

## 1. What changed

- After a successful password but failed org membership / suspended
  venue, the **venue client is signed out locally** (`scope: 'local'`)
- Platform login that is not a platform role signs out **locally** and
  clears `platformAuth` (does not revoke the venue session)
- Failed logins re-read the remaining session on that surface so React
  matches storage
- Wrong password still leaves the previous session in place

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. While signed in as the venue administrator, open another venue’s
   login link and submit the **platform** (or any non-member) password —
   sign-in should fail and the original venue session should still work
   at `#/home`
3. On Platform login, a venue-only account should fail without signing
   the venue workspace out

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **910 passed / 5 skipped** |
| `npm run build` | Pass — **2,323.87 kB / 555.34 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #218.*
