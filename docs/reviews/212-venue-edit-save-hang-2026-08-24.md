# Review #212 — Venue edit Save no longer hangs

Changing a venue from **provisioning** to **active** left **Save venue
changes** stuck on **Saving…**. The update RPC could finish, but the
button waited for a full console reload. That reload includes
`get_platform_console_metrics`, which suddenly scans the venue’s
`org_data` once the status is active.

## 1. What changed

- Save completes as soon as `update_venue_organization` returns
- Console list/metrics refresh in the background and no longer block the button
- Save and address verification time out instead of spinning forever
- Update errors (including missing function / forbidden) are shown as toasts

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Open the venue, set Status to **Active**, click **Save venue changes**
3. The button should return to **Save venue changes** and a success toast should appear
4. If the update function is missing, apply `0014_geoapify_address_quality.sql` (includes `update_venue_organization`)

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **887 passed / 5 skipped** |
| `npm run build` | Pass — **2,310.91 kB / 552.94 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #212.*
