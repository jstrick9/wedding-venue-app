# Review #228 — Reissue, revoke, suspend, and invite email must not hang

Activate, archive, restore, onboard, list, login, and claim already had
deadlines. Reissue, revoke, suspend, and Brevo invite send did not. A
stalled RPC left **Reissue & email invite** disabled. A stalled email
after Create Venue left **Creating venue…** even though the tenant
existed.

## 1. What changed

- Reissue times out at **20s**
- Revoke times out at **20s**
- Suspend times out at **20s**
- Invite email send times out at **20s**; the toast still tells the
  operator to copy the setup link

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Reissue, revoke, or suspend should not stay disabled if the RPC
   stalls — you get a timeout and can try again
3. If the invite email times out after onboard/reissue, copy the setup
   link from the preview

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **929 passed / 5 skipped** |
| `npm run build` | Pass — **2,326.64 kB / 555.85 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #228.*
