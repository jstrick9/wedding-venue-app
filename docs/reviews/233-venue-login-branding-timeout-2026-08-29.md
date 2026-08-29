# Review #233 — Venue login branding must not hang

`#/venue-login/<slug>` awaited `get_public_venue_branding` with no deadline
and no `catch`. If the public RPC stalled or threw, **Loading venue
sign-in** never cleared. Platform login hydrates branding in the
background and does not block the form; venue login still needs the RPC
for `organizationId`, so the form cannot paint first — but the busy card
must time out.

## 1. What changed

- Public venue branding lookup times out at **20s**
- A thrown or timed-out lookup always clears the loading card
- Timeout shows **Venue sign-in timed out** with **Try again** (and
  Platform login)
- Invalid slug still shows **Venue login not found**

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Open a venue login link. If branding stalls, you leave Loading venue
   sign-in after 20s and can try again
3. A good slug still opens the branded Sign In form

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **943 passed / 5 skipped** |
| `npm run build` | Pass — **2,328.24 kB / 556.14 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #233.*
