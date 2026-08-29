# Review #236 — Accepting a staff invite must not hang

`#/accept-invite/<token>` awaited `acceptInvite` with no deadline and no
`catch`. If the RPC stalled or threw, **Accepting invite…** never
cleared. After a successful accept, `refreshSession` could stall the
same way.

## 1. What changed

- Accept invite times out at **20s**
- Timeout or throw shows **Invite issue** with **Back to workspace**
- Cloud `refreshSession` times out at **20s** (still best-effort after
  a successful accept)

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Open a staff `#/accept-invite/…` link while signed in
3. If accept stalls, you leave Accepting invite… after 20s and can go
   back to the workspace

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **950 passed / 5 skipped** |
| `npm run build` | Pass — **2,328.83 kB / 556.25 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #236.*
