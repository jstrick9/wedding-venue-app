# Review #221 — Provisioning venues must allow venue login

After a claimed invite, the tenant stays **provisioning** until Activate.
Venue login treated only `active` as allowed. A valid owner password at
`#/venue-login/<slug>` then locally signed out (#218) and failed, so the
new administrator was locked out until a platform operator activated the
venue.

Suspend / Archive still block login. Restoring a venue session for a
**suspended** organization now also signs that surface out locally so
console Suspend sticks on reload.

## 1. What changed

- Venue sign-in is allowed for **provisioning** and **active**
- **Suspended** and **archived** still reject login (local sign-out)
- Restoring `wvip-auth-venue` for a suspended/archived tenant drops that
  session

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Onboard a venue, claim `/i/<token>`, sign out
3. Venue login with the new password should work **before** Activate
4. **Suspend venue access** should still block that venue login after
   reload

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **916 passed / 5 skipped** |
| `npm run build` | Pass — **2,324.38 kB / 555.42 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #221.*
