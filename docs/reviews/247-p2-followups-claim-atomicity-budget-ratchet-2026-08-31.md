# Review #247 — Post-0016 Verification + P2 Follow-up Remediation (Claim Atomicity, Bundle Budget, `@ts-nocheck` Ratchet)

**Date:** 2026-08-31 · **Scope:** `main @ 436902a` → this review's commits
**Method:** live anon-key probes (same pattern as Review #246) + regression suite + code implementation for the three P2 follow-ups deferred from Review #245.
**Live project:** `https://wqyrbikrvyqabqnwgtlh.supabase.co` (anon key only; service-role key not used, per audit constraints).

---

## §1 Post-0016 verification (deferred checks from Review #246)

Re-ran the full anon-reachable regression suite plus the migration-fingerprint probes that could be observed without service-role access.

| Check | Result |
|---|---|
| 16-table anon isolation (inserts → 42501 RLS) | ✅ PASS |
| `metrics` / invite-reissue RPCs forbidden to anon | ✅ PASS |
| `invalid_submission` insert → RLS 42501 | ✅ PASS |
| Edge Functions: `claim-venue-admin` 400 `invalid_token`; `geocode-venue`/`send-email` 401 | ✅ PASS |
| Storage public-logo read 200; anon uploads denied | ✅ PASS |
| **MIME allowlist live state** | ✅ **= `{png, jpeg, webp, gif}` exactly** — svg/bmp → `invalid_mime_type`, png/jpeg/webp/gif → policy-denied (MIME passed). **P2-E closed live regardless of whether 0016 was applied**: the live allowlist already equals 0016's target. |
| **0016 apply state** | ⚠️ NOT anon-observable. PostgREST plan API returns 406 `PGRST107` (db-plan-enabled off), so the index cannot be verified via REST. Since Review #246 §5 operator SQL has not been run, **assume 0016 unapplied**. |
| **Graph cleanup (LV-1)** | ❌ **STILL OPEN.** `get_platform_outlook_status` / `disconnect_platform_outlook` RPC probes still forbidden (expected — revoked), `platform_mail_secrets` still exists. The 4 idempotent drops + ledger reconciliation from Review #246 §5 have **not** been run. |

**Verdict:** post-0016 state is safe as-is (no anon-observable regression), but the operator actions in Review #246 §5 remain pending: (1) apply `0016` via SQL editor, (2) run the 4 Graph-leftover drops, (3) run the ledger reconciliation query, (4) re-check MIME allowlist (now confirmed already conformant).

---

## §2 P2-G — Atomic venue-admin claim + throttle (fixed)

**Finding (from #245, confirmed live in #246):** the claim flow had a two-phase gap. The Edge Function set the account password but left the invite `pending`; ownership transfer happened only when the browser later called `accept_venue_admin_invite` as the signed-in user. Abandoning the flow after the password step left a live, reusable token that could reset the password again, and there was no rate limit on token guessing against the Edge Function (`get_venue_admin_invite_context` hashed the token but nothing throttled attempts). CORS reflects arbitrary origins (confirmed live, Review #246), which makes the unthrottled brute-force surface real.

### Fix 1 — `supabase/migrations/0017_atomic_venue_admin_claim_and_throttle.sql`

New objects (all `security definer`, `set search_path = public`, **revoke execute from public/anon/authenticated** — service-role only):

1. **`venue_admin_claim_attempts`** — per-token-hash attempt counter (token_hash PK, failure_count, last_failure_at, locked_until). RLS enabled, no row grants; service-role only.
2. **`venue_admin_claim_gate(p_token)`** — rolling-window throttle: ≥10 failures in the last hour → lock 15 minutes (429 semantics). Reads use `security definer` to bypass RLS; no data is exposed (returns `{locked, remaining_seconds, failure_count}`).
3. **`register_venue_admin_claim_failure(p_token)`** — increments the counter, prunes entries older than 1 hour. No-op if the row is locked (lock time is not extended by further attempts during the lock).
4. **`claim_venue_admin_account(p_token, p_user_id, p_email)`** — the atomic claim, one transaction:
   - `select … for update` on the invite row (serializes concurrent claims),
   - re-validates everything the old client-side path validated: status/expiry/email-match, org not suspended/archived/deleted,
   - idempotent for the same user: invite already accepted by `p_user_id` + active membership → `ok: true, already_claimed: true` without re-transfer,
   - `already_claimed` error if a different user accepted it; `claim_conflict` on unique-violation catch,
   - demotes other owners to `admin`, transfers `owner_id` to the claimant, clears suspension fields, upserts `platform_memberships` with the invite role, marks invite `accepted` (with `accepted_by`/`accepted_at`), deletes the throttle-attempt row,
   - writes a `platform_audit_logs` entry: action `venue_admin_invite.claimed`, actor = claimant, target org.
5. **`accept_venue_admin_invite` (patched)** — gains an idempotent re-accept branch: invite already accepted by the calling user + active membership → `ok: true, already_accepted: true`. This keeps the **unchanged client flow** working after an Edge-side claim: the client's post-sign-in RPC accept succeeds instead of erroring `not_found`.

A fix review pass caught and removed a duplicated idempotency query with an invalid column reference (`acceptced_by`) before commit — noted here because the migration was drafted with that bug.

### Fix 2 — `supabase/functions/claim-venue-admin/index.ts`

Order of operations, all degrading gracefully when migration 0017 is not yet applied live (the Edge Function deploys independently of SQL):

1. **Gate first:** `venue_admin_claim_gate(p_token)` → locked ⇒ HTTP **429** with a friendly message. RPC missing ⇒ proceed (try/catch, no throttle — current behavior).
2. **Invalid token ⇒ count it:** `register_venue_admin_claim_failure` on `get_venue_admin_invite_context` error or `ok:false` (best-effort; `invalid_token` short-circuits before any Auth mutation).
3. **Password, then claim:** existing createUser/updateUserById + profile update unchanged, then `claim_venue_admin_account(p_token, userId, email)`:
   - `ok` ⇒ respond `claimed: true` (invite consumed atomically),
   - explicit rejection (`already_claimed`, expired, suspended org …) ⇒ HTTP 400 with the reason,
   - RPC missing/throws ⇒ `claimed: false`, invite stays `pending`, and the client-side accept fallback (already implemented in `AuthBackend.signUpVenueAdminWithInvite`) completes the transfer exactly as before.
4. Response now includes a **`claimed`** boolean so the client can skip or keep its accept step; no client changes required for correctness.

**Regression guard:** `src/services/platform/claimVenueAdminAtomic.test.ts` (7 tests) pins the contract on both artifacts: gate-before-Auth-mutation ordering, 429, failure registration on invalid tokens, claim-after-password ordering, `for update` row lock in the migration, revoke lines for all three service RPCs, throttle constants (10/1h/15min), audit action, and the idempotent accept branch.

---

## §3 P2-H — CI bundle budget gate (fixed)

`scripts/check-bundle-budget.mjs` (+ pure-logic tests in `scripts/check-bundle-budget.test.mjs`):

- **`evaluateBudgets(entries, mode)`** exported pure function; CLI modes `single` / `split`.
- Budgets (bytes, defined in one place): single-file `dist/index.html` gzip ≤ **620 KiB** (current: 543.88 KiB gzipSync-measured = 556.94 kB Vite-reported); split-build per-chunk raw ≤ **820 KiB** (current largest: `chunk-admin` 733.96 KiB = 751.57 kB Vite-reported). ~11% headroom — tight enough to catch a regression, loose enough that routine dependency bumps don't trip it.
- Measurement uses `node:zlib.gzipSync` directly (no new dependency).
- **CI wiring order matters:** `npm run build` → `budget single` → `npm run build:split` → `budget split`, because `build:split` **overwrites `dist/index.html`** and the single-file measurement must happen before that.
- Exceeding a budget fails the step with an actionable message: raise the budget *in the same commit that justifies it*.

## §4 P2-I — `@ts-nocheck` ratchet (fixed)

`scripts/check-ts-nocheck-ratchet.mjs` (+ tests in `scripts/check-ts-nocheck-ratchet.test.mjs`):

- Counts runtime (non-test) `.ts/.tsx` files under `src/` containing `@ts-nocheck`; **fails CI above the ceiling of 24** (the exact current baseline — verified: 24 files, the entire venue-admin console surface listed by the script on failure).
- Ceiling is a named constant; the intended motion is downward-only as files get retyped. The script prints the full offending-file list so a failure is self-explanatory.
- New CI step `@ts-nocheck ratchet` after the build steps; also runnable as `npm run ratchet`.

New npm scripts: `budget:single`, `budget:split`, `ratchet`.

---

## §5 Verification

| Gate | Result |
|---|---|
| ESLint | 0 errors / 30 warnings (unchanged baseline) |
| `tsc --noEmit` | clean |
| Vitest | **999 passed / 5 skipped** (+15 new: 7 claim-atomicity, 4 budget, 4 ratchet) |
| Build single-file | 2,332.51 kB / 556.94 kB gzip — within budget |
| Build split | largest chunk `chunk-admin` 751.57 kB raw — within budget |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Budget + ratchet scripts, CLI modes | pass locally against fresh `dist/` |

CI now runs: lint → tsc → test → build → **budget single** → build:split → **budget split** → **ratchet** → audit.

**Edge Function deploy:** `deploy-edge-functions.yml` triggers on `supabase/functions/**` changes and auto-deploys `claim-venue-admin`; the function is written to be correct whether or not 0017 is applied live yet (gate/claim/failure RPCs each individually optional).

## §6 Open items for the operator (unchanged from #246 §5)

1. **Apply migration 0016** (snapshot-lock token index + branding MIME) via SQL editor — assumed still unapplied; idempotent.
2. **Apply migration 0017** after the Edge Function deploys — enables the throttle + atomic claim.
3. **Graph cleanup (LV-1):** the 4 idempotent drops (`platform_mail_secrets` is empty — verified live) + `supabase_migrations.schema_migrations` reconciliation.
4. Re-run the MIME probe after 0016 (currently already conformant).

## §7 Verdict

All three deferred P2 follow-ups are remediated and gated. The claim path is now atomic end-to-end (or safely falls back to the previous two-phase flow when 0017 isn't applied), token brute-force is throttled, bundle growth and `@ts-nocheck` growth are both CI-enforced ratchets. Remaining risk is operational, not code: the pending SQL operator actions in §6.
