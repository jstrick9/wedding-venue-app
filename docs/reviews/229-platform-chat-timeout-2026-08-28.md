# Review #229 — Platform chat load and send must not hang

Console Chat (and venue-detail / venue Admin Platform Chat) awaited
`listPlatformVenueMessages` and `sendPlatformVenueMessage` with no
deadline. A stalled thread left **Loading chat…** forever; Send could
be clicked again while the first request was still in flight.

## 1. What changed

- Chat list times out at **20s**
- Chat send times out at **20s** and shows **Sending…**
- Overlapping list polls are skipped while a load is in flight

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Open Chat — if the thread stalls, you get a timeout instead of
   Loading chat…
3. Send should not stay on Sending… if the insert stalls
4. Chat tables still need live **0009** + **0010** if messages fail
   with a missing-table error

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **931 passed / 5 skipped** |
| `npm run build` | Pass — **2,326.99 kB / 555.93 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #229.*
