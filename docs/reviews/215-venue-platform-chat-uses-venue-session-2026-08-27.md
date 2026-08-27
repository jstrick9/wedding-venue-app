# Review #215 — Venue Platform Chat uses the venue session

Venue Admin → Platform Chat listed and sent through the **platform**
Supabase client (`wvip-auth-platform`). After dual sessions (#209), that
JWT is the platform administrator (or missing). RLS requires
`is_org_member` for venue-side rows, so venue staff could not load or
send the thread.

## 1. What changed

- Chat list/send/subscribe/read-markers use the **venue** client when
  `senderSide` is `venue`, and the **platform** client when it is
  `platform`
- Venue Admin Platform Chat passes `senderSide="venue"`
- Missing-session errors name the correct login (venue vs platform)

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Sign in as the venue administrator (not the platform account)
3. Admin & System Settings → **Platform Chat**
4. Messages should load; Send should post as **Venue**
5. Platform console → Chat still uses the platform login

Apply **0009** and **0010** in live SQL if the chat table/trigger is missing.

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **895 passed / 5 skipped** |
| `npm run build` | Pass — **2,318.30 kB / 554.39 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #215.*
