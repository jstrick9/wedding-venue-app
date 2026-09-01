# Review #262 — Phase 3: authorization proof matrix, columns 1–3 of 5 (anon live-complete; guest/couple derived; venue/platform policy-derived)

**Date:** 2026-09-01 · **Mode:** continuous campaign · One finding (F-262-1, P3, fixed in migration 0020). The anon column is now live-proven for all 29 tables; guest/couple columns are derived-complete; venue/platform columns are policy-derived pending sign-in artifacts (request 3.1).

## Method

**Live anon sweep** (publishable key, zero data written except one rate-slot acquisition already logged in #261):

1. **GET sweep** — all 29 tables × `select=*&limit=2` → **29/29 returned HTTP 200 with an empty array**: RLS is enabled everywhere and silently filters anon. Zero rows leak.
2. **INSERT discriminator** — empty-object `{}` insert per table: HTTP 401/`42501` (RLS WITH CHECK rejection) on 27/29 tables = policy-denied. Two exceptions, one of them the finding:
   - `audit_logs` → `23502` (NOT NULL on `action`) — **the insert passed the RLS check** and was only stopped by a constraint (F-262-1 below).
   - `platform_venue_messages` → `P0001` (the `set_platform_chat_sender_side` trigger's `raise exception 'caller is not allowed to post platform chat'`) — correct: BEFORE-row triggers run ahead of WITH CHECK, so the #180 N-6 trigger is the first gate, and the insert policy *also* requires `sender_user_id = auth.uid()` plus role-derived sender_side. Defense in depth holds; nothing landed.
3. **UPDATE/DELETE** — impossible-filter probes (`id=eq.<nonexistent>`) returned 204 (zero-row no-ops) across the board. This proves filters match nothing anon can address — and since anon *sees* zero rows on every table (GET sweep) and every write policy derives from `auth.uid()`/org roles (inventory below), row-targeted writes are inert for anon. No write occurred on any table.

**Policy inventory** — every `create policy`/`drop policy`/`enable row level security` statement across migrations 0001–0017, resolved in migration order to each table's effective policy set. This drives the venue/platform column verdicts and re-verified the #246/#247 certifications.

## Finding

**F-262-1 (P3 — RLS hole, live-proven): the legacy `audit_logs` table treated `organization_id is null` as a free pass.** Both 0001 policies contained the clause without a platform-role check:

- `audit_select_admins`: `organization_id is null or has_org_role(...)` → anyone (anon included) could read every org-less audit row.
- `audit_insert_members`: `organization_id is null or is_org_member(...)` → anyone could **forge audit rows** simply by omitting `organization_id`.

Live evidence: the empty-object anon insert on `audit_logs` failed with `23502` — RLS had already said yes — while all 27 correctly-protected tables failed with `42501`. The table is legacy (the app reads `platform_audit_logs`; no client code or RPC writes `audit_logs`), currently empty of org-less rows (GET returned `[]`), which is why the hole went unnoticed. Still a standing anonymous write/read surface.

**Fixed in `0020_review_262_audit_logs_rls.sql`** — both policies replaced with the `platform_audit_logs` pattern: SELECT = org admins for org-scoped rows OR `is_platform_support()` for org-less rows; INSERT = `is_org_member` with a **non-null** organization_id. Service-role writers (if any ever exist) bypass RLS and are unaffected. Pinned by `src/services/org/auditLogsRls.pin.test.ts` (2 tests, including a "no null-org free pass" negative assertion).

## Verified-good highlights from the inventory

- `org_data` writes: member + `org_data_write_allowed` domain gate (the #180 remediation) — re-confirmed on all three write policies.
- `organizations` insert-any-authenticated: **intentional** — `AuthBackend` bootstraps an org + owner membership at sign-up so new users have an RLS scope. Declined as a finding (self-serve flow; junk-org exposure is accepted product behavior).
- Three tables intentionally carry **no policies** (`venue_geocode_rate`, `venue_geocode_cache`, `venue_admin_claim_attempts`) = deny-all for every client role, service-role only. Live-confirmed (GET empty, INS 42501).
- `platform_*` tables consistently use the tight pattern (`is_platform_support()` / `platform_user_id = auth.uid()` / admin-only) — the audit_logs flaw was the one 0001-era outlier.

## Column verdicts (full matrix in the registry)

- **anon (29/29 live):** denied everywhere, pre-0020 exception noted; `org_data`, `platform_memberships`, `venue_admin_invites`, `venue_admin_claim_attempts` re-verified against their #246/#247 certifications.
- **guest / couple (derived):** guests and couples are *anon* at the Postgres level — direct table access inherits the live-proven anon denial; their entire data surface is the token-gated security-definer RPC layer audited in Phase 2 (#258: token-hash lookups, per-token expiry, own-record-only reads, locked+validated writes, tokens stripped from responses).
- **venue / platform (policy-derived, live proof pending request 3.1):** per-table verdicts from the inventory (member/role-based selects and role-tiered writes; platform admin overrides on organizations/memberships/org_invites/profiles; platform-support audit reads). The sign-in probe session needs: a throwaway sign-up claiming the board's pending venue-admin invite (covers the venue column and journey 8.1), one plain fresh sign-up (negative cells + the bootstrap flow), and a platform_memberships grant — SQL script provided below.

## Operator SQL (request 3.1c — platform column live proof)

```sql
-- After the throwaway account exists (auth.users id known), grant it a
-- platform role for probe purposes. Reversible.
insert into public.platform_memberships (user_id, role, status)
values ('<THROWAWAY_USER_UUID>', 'platform_support', 'active')
on conflict (user_id) do update set role = 'platform_support', status = 'active';
```

## Live mutation log (this session)

None. (All Phase 3 probes were reads or constraint-failing/RLS-denied writes; the one rate-slot write from #261 predates this review.)

## Gates

tsc + strict unused-locals scan clean (non-test) · eslint 0 errors / 30 warnings · vitest 1039 passed / 5 skipped (+2) · single-file 546.51 kB gzip + split chunks within budget · audit clean.

## Registry delta

Phase 3 matrix rewritten with per-cell verdicts and the method legend; request 3.1 added to the artifact board. Migrations 0018–0020 pending live application (operator). Phase 3 remains open on the venue/platform columns' live proof (needs request 3.1); everything else in the section is complete.
