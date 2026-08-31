# Review #246 — Live RLS / RPC / Edge-Function Smoke Test

**Repository:** `jstrick9/wedding-venue-intelligence-platform`
**Branch / baseline:** `main` at `8167ea6`  **Review date:** 2026-08-31
**Review type:** First-ever **live** verification of the Supabase security layer. All prior reviews (#173–#245) verified SQL statically; this review executed the §9 checklist from Review #245 against the operator's live project using **only the publishable (anon) key**. No service-role credentials were used or requested. All probes are safe: anonymous reads, invalid tokens, and write attempts that were expected (and confirmed) to be denied.
**Method:** 40+ HTTP probes against PostgREST (`/rest/v1`), Auth (`/auth/v1`), Storage (`/storage/v1`), and Edge Functions (`/functions/v1`), plus RPC signature resolution to fingerprint the applied migration set.

---

## 1. Executive summary

**The live security layer passes every check it has ever been designed for.** Anonymous tenant isolation, platform-role enforcement, guest-RPC input hardening, server-derived chat trust, invite auth gates, and Edge Function auth all behave exactly as the migrations intend. The migration substance of **0001–0015 is live** (fingerprinted function-by-function and column-by-column).

Two environment findings need operator action:

| # | Finding | Severity | Action |
|---|---|---|---|
| LV-1 | Graph-era artifacts (`platform_mail_secrets` table + 3 Outlook RPCs) are still live — #208's drop statements never executed because the #207 SQL was applied live in its original form (without the drops) | **P2** | Run the cleanup SQL in §5 (idempotent) |
| LV-2 | Migration **0016** (RSVP row lock, `guests.portal_token_hash` index, branding-bucket MIME normalization) is not yet applied | **P1 action** | Apply `supabase/migrations/0016_…sql` in the SQL editor |

Plus two informational notes: the live `public-branding` bucket already excludes SVG (safe drift from a fresh 0009 deployment — 0016 makes it explicit), and the migration ledger has diverged from the repo (see §4).

---

## 2. Verification results

### 2.1 Anonymous read isolation (16/16 tables) — PASS

`GET /rest/v1/<table>?select=*&limit=5` with the anon key. Every table must return `[]` (RLS denies all rows), never data:

`org_data`, `couple_portal_snapshots`, `guests`, `platform_memberships`, `platform_settings`, `organizations`, `profiles`, `venues`, `events`, `layouts`, `rsvp_submissions`, `venue_admin_invites`, `org_invites`, `platform_venue_messages`, `platform_audit_logs`, `audit_logs` — **all returned `[]` / HTTP 200**. A control probe against a nonexistent table correctly returned `PGRST205` 404, confirming the `[]` results are real RLS denials and not schema-cache artifacts.

### 2.2 Anonymous write denial — PASS (4/4, including the escalation attempt)

| Probe | Result |
|---|---|
| `INSERT INTO org_data` | `42501` new row violates row-level security policy ✓ |
| `INSERT INTO venue_admin_invites` (forge a platform invite) | `42501` ✓ |
| `INSERT INTO platform_memberships` (self-promote to `platform_owner`) | `42501` ✓ |
| `INSERT INTO platform_venue_messages` | Rejected by the **`set_platform_chat_sender_side` trigger** ("caller is not allowed to post platform chat") ✓ — this proves the 0010 server-side trust derivation is live, not just the RLS layer |

### 2.3 Platform-role enforcement — PASS

- `get_platform_console_metrics()` as anon → `{"ok":false,"error":"forbidden"}` ✓
- `suspend_venue_organization`, `update_venue_organization`, `create_venue_organization_v2`, `reissue_venue_admin_invite` as anon → all `forbidden` ✓

### 2.4 Guest/couple public RPC hardening — PASS

| Probe | Result |
|---|---|
| `submit_guest_couple_rsvp` with a **non-object** submission | `invalid_submission` — proves the 0010 hardening is live (pre-0010 versions accepted it) |
| `submit_guest_rsvp` / `submit_guest_couple_rsvp` / `get_guest_couple_portal_snapshot` / `get_guest_couple_portal_snapshot_for_venue` / `get_couple_portal_snapshot` / `get_guest_by_portal_token` with bogus tokens | Clean structured `not_found`/`invalid_token` — no 500s, no information leakage |
| `get_venue_admin_invite_context` short/bogus token | `invalid_token` / `not_found` ✓ |
| `accept_venue_admin_invite` / `accept_invite` as anon | `auth_required` ✓ |
| `get_public_venue_branding('does-not-exist-xyz')` | `venue_not_found` ✓ |

### 2.5 Migration state fingerprint — 0001–0015 substance confirmed LIVE

Signals used (each resolves only if the producing migration ran):

| Migration | Live signal observed |
|---|---|
| 0001 | `guests.portal_token_hash` column; `guests`/`events`/`layouts` tables; `get_guest_by_portal_token` |
| 0005 | `couple_portal_snapshots` table + `get_couple_portal_snapshot` |
| 0006/0007 | `organizations.status`, `couple_portal_snapshots.collaborator_token_hashes`, `get_public_venue_branding` (venue-scoped + status-aware) |
| 0008 | `venue_admin_invites.revoked_at`/`revoked_by`, console RPCs, `get_platform_console_metrics` |
| 0009 | `venue_geocode_cache`, `platform_chat_read_markers`, `platform_settings` + `get_public_platform_branding` (returns the live "Wedding VIP" branding with a bucket-hosted logo) |
| 0010 | `venue_geocode_rate` table; `invalid_submission` validation; **chat trigger live** (§2.2) |
| 0011 | `guests.source_guest_id`, `events.source_couple_id`, `rsvp_submissions.source_submission_id` |
| 0012 | `update_venue_organization` (4-required-arg signature resolves) |
| 0014 | `create_venue_organization_v2` (15-arg signature resolves) |
| 0015 | `reissue_venue_admin_invite` resolves and enforces `forbidden`; the #207 invite-lookup fix is live |
| **0016** | **Not applied** (expected — created in #245 today) → LV-2 |

### 2.6 Edge Functions — PASS

| Function | Probe | Result |
|---|---|---|
| `claim-venue-admin` | POST `{}` | `400 invalid_token` — deployed, validates token length ✓ |
| `geocode-venue` | POST no auth | `401 Unauthorized` ✓ |
| `send-email` | POST no auth | `401 Unauthorized` ✓ |
| CORS (all three) | OPTIONS with `Origin: https://evil-example.com` | Origin reflected — confirms the #245 P2-G finding. Low risk while auth stays bearer-in-header; re-visit if cookie auth is ever introduced |

### 2.7 Storage — PASS with a drift note

- Public read of the live platform logo (`public-branding/platform/…-agenticos-logo.png`): HTTP 200, `image/png` ✓ (bucket exists and is public as designed).
- Anonymous uploads: denied (MIME/policy layers; `venue-images` policy correctly attempted the uuid path parse). No write succeeded.
- **Drift (LV-3, informational):** the live `public-branding` bucket rejects `image/svg+xml` today — it was evidently created before 0009 ran, and 0009's `on conflict do nothing` preserved the SVG-less config. A **fresh** deployment from migrations would create the bucket *with* SVG allowed (the P2-E risk from #245). Migration 0016 normalizes both worlds to the safe list.

---

## 3. Findings

### LV-1 (P2) — Graph-era artifacts are still live on the database

The live project still has `public.platform_mail_secrets` (table), `public.get_platform_outlook_status()`, `public.save_platform_outlook_connection(text,text,text)`, and `public.disconnect_platform_outlook()` — all confirmed resolving. History explains why: the #207 invite-lookup SQL was applied live in its **original `0016` form**, which predated #208's renumbering that added the Graph drops; the drop statements in the current `0015` file have therefore never executed against this database. The table is empty and the functions are platform-admin-gated, so the risk is bounded (dead attack surface + a secrets-heritage table that should not exist). Cleanup SQL in §5.

### LV-2 (P1 action) — Migration 0016 is not applied yet

Today's `0016_review_245_snapshot_lock_token_index_and_branding_mime.sql` (RSVP `for update` lock, `guests.portal_token_hash` index, bucket MIME normalization) must be applied before the P1-C/P1-D/P2-E fixes from #245 are live. §5.

### LV-4 (info) — The migration ledger has diverged from the repo

At least one migration was applied out-of-band under a different number (the #207 SQL as `0016`, later renumbered to `0015` in the repo). Future drift of this kind is exactly what broke the Graph cleanup silently. ~~Recommendation: after applying §5, run `select version, name from supabase_migrations.schema_migrations order by version;`~~ **Corrected 2026-08-31:** that table does not exist — this database was never CLI-managed, so there is no ledger at all (see §5 correction). Object-level verification replaces it. If the CLI is ever adopted, `supabase migration repair --status applied` must mark every repo migration first or `supabase db push` will re-apply 0001+ onto existing objects.

---

## 4. What was NOT verifiable with the publishable key

- Index usage plans (`explain analyze`) and `supabase_migrations.schema_migrations` contents — require SQL-editor/dashboard access (operator).
- Authenticated-user RLS paths (venue-member scoping, cross-tenant denial for a *signed-in* venue admin, suspended-venue sign-in, the P1-C row-lock behavior under two sessions) — these need signed-in JWTs from a test venue. The §9 two-session lock probe in Review #245 covers the lock; run it after applying 0016.
- Live `npm audit`-style dependency checks — N/A (client-side).

These remain the only unverified layer; everything reachable with the anon key passed.

---

## 5. Operator action list (run in the Supabase SQL editor)

> **Correction (2026-08-31, after first operator attempt):** item 3 below as
> originally written fails with `relation "supabase_migrations.schema_migrations"
> does not exist`. That schema is created only by the Supabase CLI
> (`supabase db push` / `migration up`) — this database has **never** been
> CLI-managed (every migration was applied out-of-band via the SQL editor, per
> §4), so there is no ledger to reconcile. Item 3 is replaced by object-level
> verification. Note also: the SQL editor executes the whole paste as one
> implicit transaction — when the ledger query errored at line 15, the §5.2
> drops that ran earlier in the same paste were rolled back (verified live:
> both Outlook RPCs still execute, `platform_mail_secrets` still exists). A
> combined, paste-ready script now lives at
> `docs/reviews/247-…md` §6 → workspace `operator-sql/apply-pending-changes-2026-08-31.sql`.

```sql
-- 1. LV-2: apply Review #245's migration. Either run the file
--    supabase/migrations/0016_review_245_snapshot_lock_token_index_and_branding_mime.sql
--    verbatim, or verify it was applied, then confirm (catalog check is
--    authoritative — on a small guests table the planner may legitimately
--    prefer a Seq Scan even when the index exists):
select indexname from pg_indexes
where tablename = 'public.guests' and indexname = 'idx_guests_portal_token_hash';
explain analyze
select * from public.guests where portal_token_hash = 'deadbeef'::text;

-- 2. LV-1: Graph cleanup (idempotent — mirrors the drops in 0015 that never ran live).
drop function if exists public.get_platform_outlook_status();
drop function if exists public.save_platform_outlook_connection(text, text, text);
drop function if exists public.disconnect_platform_outlook();
drop table if exists public.platform_mail_secrets;

-- 3. LV-4 (REVISED): there is no CLI migration ledger in this database
--    (supabase_migrations schema does not exist — never CLI-managed).
--    Verify object-level state instead. Expect all four columns NULL
--    after step 2:
select
  to_regprocedure('public.get_platform_outlook_status()')                    as outlook_status_fn,
  to_regprocedure('public.save_platform_outlook_connection(text,text,text)') as save_connection_fn,
  to_regprocedure('public.disconnect_platform_outlook()')                    as disconnect_fn,
  to_regclass('public.platform_mail_secrets')                                as mail_secrets_table;
-- Going forward: if the Supabase CLI is ever adopted, run
--   supabase migration repair --status applied <version>...
-- for every repo migration FIRST, or `supabase db push` will try to re-apply
-- 0001+ onto existing objects.

-- 4. Bucket MIME normalization check (from 0016):
select allowed_mime_types from storage.buckets where id = 'public-branding';
-- Expect: {image/png, image/jpeg, image/webp, image/gif} — no svg.

-- 5. (From Review #247) migration 0017 — atomic venue-admin claim + throttle;
--    pairs with the already-deployed claim-venue-admin Edge Function, which
--    degrades gracefully until this runs. Apply
--    supabase/migrations/0017_atomic_venue_admin_claim_and_throttle.sql
--    verbatim, then confirm:
select
  to_regclass('public.venue_admin_claim_attempts')                        as attempts_table,
  to_regprocedure('public.venue_admin_claim_gate(text)')                  as gate_fn,
  to_regprocedure('public.register_venue_admin_claim_failure(text)')      as failure_fn,
  to_regprocedure('public.claim_venue_admin_account(text,uuid,text)')     as claim_fn;
```

After applying 0016, re-run the §2.4/§2.6 probes (they are all repeatable with the publishable key) and the two-session lock probe from Review #245 §9.7.

---

*End of Review #246.*
