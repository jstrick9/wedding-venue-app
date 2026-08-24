# Review #208 — Invite-lookup SQL is migration 0015

Graph Outlook send is unused. The unused Graph file occupied `0015`, which
pushed the live invite-lookup fix to `0016`. That numbering is gone.

## 1. What changed

- Deleted `supabase/migrations/0015_platform_outlook_graph.sql`
- Moved claimed-venue reissue / invite lookup SQL to
  **`supabase/migrations/0015_reissue_claimed_venue_and_invite_lookup.sql`**
- New 0015 also `DROP`s leftover Graph table/functions if they were applied
- Setup-page operator copy now says run **0015**, not 0016
- There is no migration 0016

## 2. Operator (required)

1. Supabase → **SQL Editor**
   (`https://supabase.com/dashboard/project/wqyrbikrvyqabqnwgtlh/sql`)
2. Paste and run all of `supabase/migrations/0015_reissue_claimed_venue_and_invite_lookup.sql`
3. Hard-refresh the app
4. Open the existing `/i/va-…` link again — lookup should show the signup form
5. Or Platform Console → venue → **Reissue & email invite** / **Reissue owner invite**

Do not look for 0016. Do not apply Graph Outlook SQL.

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **874 passed / 5 skipped** |
| `npm run build` | Pass — **2,306.79 kB / 551.47 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #208.*
