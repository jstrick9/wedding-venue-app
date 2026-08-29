# Review #226 — Invite preview must match the current venue

`inviteCompose` was portal-wide `useState`. After onboard or reissue,
opening a different venue’s detail still showed that invite HTML. The
operator could copy the wrong setup email or link.

## 1. What changed

- Invite compose state is `{ organizationId, message }`
- Venue detail shows the preview only when it matches the open venue
- Onboard shows the preview only when it matches the created venue
- Reissue on Hilltop no longer leaves the iframe on Seven Paths Manor

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Reissue & email invite on one venue — the HTML preview should appear
3. Open a different venue — that preview must be gone
4. Onboard a venue — the preview stays on that onboard result only

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **923 passed / 5 skipped** |
| `npm run build` | Pass — **2,326.01 kB / 555.73 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #226.*
