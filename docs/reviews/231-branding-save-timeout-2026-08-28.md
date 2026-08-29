# Review #231 — Branding save and logo upload must not hang

Platform Branding holds invite templates and TTL. Save and logo upload
awaited storage with no deadline, so **Saving…** could last forever.

## 1. What changed

- Save Platform Branding times out at **20s**
- Logo upload times out at **20s**
- Both clear the busy state on timeout

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Save Platform Branding should not stay on Saving… if the write
   stalls — you get a timeout and can try again
3. Logo upload times out the same way

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **935 passed / 5 skipped** |
| `npm run build` | Pass — **2,327.44 kB / 556.01 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #231.*
