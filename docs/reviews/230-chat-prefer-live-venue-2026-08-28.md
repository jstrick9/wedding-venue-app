# Review #230 — Chat tab must not auto-select archived venues

The Chat tab auto-selected `organizations[0]`. The directory is oldest
first, so an archived or suspended tenant could open as the default
thread. Operators then talked to a venue that cannot sign in.

## 1. What changed

- Default Chat thread prefers **active**, then **provisioning**
- Archived and suspended venues stay in the thread list and can still
  be opened by hand
- If every venue is archived/suspended, the first row is still used

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Open Chat — the selected thread should be a live venue when one
   exists
3. Archived/suspended venues remain in the list if you need them

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **933 passed / 5 skipped** |
| `npm run build` | Pass — **2,327.19 kB / 555.97 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #230.*
