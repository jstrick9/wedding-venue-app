# Review #222 — Onboard must not hang on geocode or create

Venue detail Save already wraps geocode and `update_venue_organization`
in `withTimeout` (#212). **Onboard venue** still awaited
`geocodeVenueAddress` and `createVenueOrganization` with no deadline.
If Geoapify or the create RPC stalls, the button stays on Verifying
address… / Creating venue… and never recovers.

## 1. What changed

- Onboard address verification times out at **15s**
- Create-venue RPC times out at **20s**
- The form error shows the timeout; Saving / geocoding flags clear in
  `finally`

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Onboard a venue with a verified street
3. If address verification or create hangs, you should get a timeout
   error instead of a stuck button
4. Sign in again at Platform login if create keeps timing out

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **917 passed / 5 skipped** |
| `npm run build` | Pass — **2,324.58 kB / 555.45 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #222.*
