# Review #239 — Staff invite send must not hang

Venue Admin **Invite Members** awaited `createInvite` with no deadline
and no `finally`. If insert or Brevo stalled or threw, **Sending invite…**
never cleared. Emailed staff links were `#/accept-invite/<token>`, which
Outlook/Brevo click wrappers strip the same way as venue-admin hash
links (#206).

## 1. What changed

- Send invite times out at **20s**
- Timeout or throw toasts the error and re-enables **Send invite**
  (`try/finally`)
- New invites are path-only **`/accept-invite/<token>`** (no `?` or `#`)
- `vercel.json` rewrites `/accept-invite/:token`
- Hash `#/accept-invite/<token>` still works
- Create/accept use the venue dual-session client

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Admin → Invite Members → Send invite
3. If send stalls, you leave Sending invite… after 20s and can retry
4. New emails use `https://weddingvip.vercel.app/accept-invite/<token>`

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **962 passed / 5 skipped** |
| `npm run build` | Pass — **2,330.44 kB / 556.44 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #239.*
