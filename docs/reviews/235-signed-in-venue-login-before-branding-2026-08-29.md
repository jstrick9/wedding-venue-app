# Review #235 — Signed-in venue login must not wait on branding

`#/venue-login/<slug>` still waited on `get_public_venue_branding` before
**Open Venue Workspace**, even when the venue session already matched
that slug. A branding stall (#233) then showed **Venue sign-in timed
out** instead of the signed-in card. Unsigned visitors still need the
RPC for `organizationId`; signed-in staff do not.

## 1. What changed

- If the venue session slug matches the login slug, **Open Venue
  Workspace** paints immediately (neutral chrome until branding returns)
- A branding timeout no longer hides that card
- Suspended/archived still replace the card after branding returns
- Unsigned visitors still wait on branding with the 20s timeout

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. While signed in to a venue, reopen that venue login link — you should
   see Open Venue Workspace without waiting on branding
3. Unsigned visitors still get the branded Sign In form (or the timeout
   / not-found cards)

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **947 passed / 5 skipped** |
| `npm run build` | Pass — **2,328.64 kB / 556.21 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #235.*
