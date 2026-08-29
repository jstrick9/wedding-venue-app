# Review #225 — Archived venues must be restorable

#213 shipped Archive as an operator action. The confirm says data is
retained, but venue detail had no restore control. Suspended venues
could Reactivate; archived venues were a one-way door. The existing
`reactivate_venue_organization` RPC already restores any tenant
(active if it has an owner, provisioning if not).

## 1. What changed

- Archived venue detail shows **Restore venue**
- Restore confirms, then calls `reactivate_venue_organization` (20s
  timeout)
- Suspended still uses **Reactivate venue**
- Archive / Suspend stay hidden on archived tenants

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Open an archived venue
3. **Restore venue** should return it to active (or provisioning if it
   has no owner)
4. Venue login should work again after restore; Suspend/Archive still
   block

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **922 passed / 5 skipped** |
| `npm run build` | Pass — **2,325.87 kB / 555.72 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #225.*
