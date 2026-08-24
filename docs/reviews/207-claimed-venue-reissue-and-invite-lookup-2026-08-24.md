# Review #207 — Claimed-venue reissue and invite lookup SQL

The emailed `/i/<token>` link reached the setup page, then Postgres threw:

`invalid input syntax for type uuid: "(<whole venue_admin_invites row>)"`

The invite **was valid**. `get_venue_admin_invite_context` did
`SELECT vai INTO invite_row`. PL/pgSQL assigned that composite to the first
column (`id uuid`).

Reissue also refused venues with `owner_id` set.

## 1. What changed

- Migration **`0016_reissue_claimed_venue_and_invite_lookup.sql`**
  - Lookup selects scalar columns, not a composite row
  - Reissue allowed on provisioning/active venues even if claimed
  - Accept transfers `owner_id` to the invitee and demotes the previous owner membership to `admin`
- Venue detail: **Reissue owner invite** on claimed venues; confirm before transfer
- Setup page maps the uuid syntax error to “run migration 0016”

## 2. Operator (required)

1. Supabase → **SQL Editor**
2. Paste and run all of `supabase/migrations/0016_reissue_claimed_venue_and_invite_lookup.sql`
3. Hard-refresh the app
4. Open the existing `/i/va-…` link again — lookup should show the signup form
5. Or Platform Console → venue → **Reissue & email invite** / **Reissue owner invite**

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

*End of Review #207.*
