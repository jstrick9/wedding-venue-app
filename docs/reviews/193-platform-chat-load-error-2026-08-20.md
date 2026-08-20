# Review #193 — Platform chat “Could not load platform chat”

Opening Chat selected no venue first, queried `organization_id = ''`
(invalid UUID), stored a generic error, then never cleared it after a real
thread loaded. Supabase Postgrest errors are not `Error` instances, so the
real message was hidden.

## 1. What changed

- Do not query chat without an organization id
- Clear the error on a successful load
- Show the Postgrest message (and a migration hint if the table is missing)
- Read markers are best-effort
- Chat tab auto-selects the first venue thread

## 2. Live follow-up

If the banner mentions missing tables, apply `0009`–`0014` in the SQL Editor.

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **825 passed / 5 skipped** |
| `npm run build` | Pass — 2,281.39 kB / 542.70 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #193.*
