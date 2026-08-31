# Review #248 — Closing the Authenticated-Path Gap: `claimed` Client Wiring + Live E2E Harness

**Date:** 2026-08-31 · **Scope:** `main @ 3bbf673` → this review's commits
**Method:** code implementation + local gates; live E2E harness prepared for operator execution (needs one real invite token — see §4).
**Trigger:** Review #247 §6 named the last open gap: authenticated-path verification (real-invite claim E2E, two-session RSVP row lock, authenticated RLS scoping). "Fix any remaining gaps."

---

## §1 What was actually fixable without a live session

Two concrete items surfaced when re-reading the claim flow end-to-end:

1. **The Edge Function's `claimed` flag was dead on arrival client-side.** The 0017 claim runs atomically server-side, but `claimVenueAdminAccount()` didn't parse `claimed`, and `signUpVenueAdminWithInvite()` *always* ran the client-side `accept_venue_admin_invite` RPC afterwards. That RPC is idempotent post-0017 (`already_accepted`), so it was harmless — but it added a post-claim round-trip that could transiently fail *after the claim had already succeeded*, turning a completed onboarding into a user-visible error.
2. **The remaining verification gaps had no executable form.** "Walk the claim flow once and watch" is not reproducible. Now it is: two self-asserting probe scripts that anyone can run with the publishable key and one artifact (invite token / guest tokens).

## §2 Fix 1 — client consumes `claimed` (ship-safe for pre- and post-0017 backends)

- `src/services/platform/claimVenueAdminAccount.ts`: `ClaimVenueAdminAccountResult` gains `claimed: boolean` (parsed strictly: `payload.claimed === true`, absent → `false`, so an older Edge Function response still works).
- `src/services/backend/AuthBackend.ts` `signUpVenueAdminWithInvite`: after password sign-in, **if `claimed === true`, the client-side accept RPC is skipped** — the session is built directly from the claim response (`organizationId`/`organizationSlug` are already in it; the Edge Function already wrote the profile). If `claimed === false` (migration not applied / older function), the exact pre-existing accept path runs, unchanged.
- The RPC's idempotent branch stays as the safety net for races (e.g. claim consumed the invite a moment before an in-flight client accept).

**Tests (+3, total 1002):** `claimed:true` → RPC not called, session built from claim response; `claimed:false` → RPC called as before; missing `claimed` in response → defaults false. Existing tests untouched (falsy default preserves old behavior).

## §3 Fix 2 — the live E2E harness

### `scripts/e2e-claim-flow.mjs` — full authenticated claim E2E

Input: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `INVITE_TOKEN` (+ optional password/fullName; generates a random password otherwise and never prints it). Asserts, in order:

| # | Assertion | Proves |
|---|---|---|
| 1 | `claim-venue-admin` → 200, `ok`, **`claimed:true`** | 0017 atomic claim ran inside the Edge Function |
| 2 | password sign-in (`/auth/v1/token`) succeeds | credentials really set + confirmed |
| 3 | session reads own `organizations` row; **`owner_id` == signing-in user** | ownership transfer (the atomic claim's core) |
| 4 | `organizations` list contains the org (warns if >1 visible) | authenticated RLS scoping |
| 5 | active `platform_memberships` row for the claimant with role `owner` | membership upsert |
| 6 | venue session **cannot** list `venue_admin_invites` | authenticated-path negative RLS |
| 7 | `accept_venue_admin_invite` → `ok` + **`already_accepted:true`** | unchanged client fallback still works post-claim |
| 8 | second `claim-venue-admin` with same token → 400 **`not_found`** | the P2-G bug is dead: token unusable after claim |

Semantics note (verified against 0015): `get_venue_admin_invite_context` matches only `status = 'pending'`, so a consumed invite fails at the *context* step — the 400 in step 8 is the intended kill, not an accident.

### `scripts/e2e-rsvp-concurrency.mjs` — P1-C row lock under real concurrency

Input: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `COUPLE_ID`, `GUEST_TOKEN_A`, `GUEST_TOKEN_B` (two distinct guest-portal tokens for the same couple; `--sequential` for a sanity mode). Fires both `submit_guest_couple_rsvp` calls **simultaneously** (`Promise.all`), then reads the snapshot back through the anon-callable `get_guest_couple_portal_snapshot` and asserts **both** submissions persisted. One dropped submission = lost-update reproduced = 0016's `for update` not in effect.

Both scripts exit non-zero on any failed check and print a `[PASS]`/`[FAIL]` line per assertion — usable as runbooks, not just one-offs.

## §4 Local verification

| Gate | Result |
|---|---|
| ESLint | 0 errors / 30 warnings (baseline) |
| `tsc --noEmit` | clean |
| Vitest | **1002 passed / 5 skipped** (+3) |
| Build single / split + budgets | 543.94 KiB gzip / chunks within budget |
| `@ts-nocheck` ratchet | 24 / 24 (unchanged) |
| `npm audit --omit=dev` | 0 vulnerabilities |

## §5 Operator execution (the live run)

**Status 2026-08-31: operator chose to defer both live runs.** The harness is shipped and ready; the runs below happen whenever convenient. Until then, the authenticated-path assertions remain *prepared*, not *executed* — everything else in this review (client fix, tests, gates) is done.

1. **Claim E2E:** from the platform console, create a venue-admin invite for a throwaway email you control (or a test venue you're willing to reassign — the run *will* transfer its ownership to the test account). Pass the setup-link token from the invite email as `INVITE_TOKEN` and run the script. Cleanup afterwards = delete the test venue/membership from the console.
2. **RSVP E2E:** take two guest-portal links for the same couple (venue console → guests), run the script with both tokens. Safe: submissions are tagged `e2e-concurrency-*` and can be removed from the snapshot by the venue.

## §6 Verdict

The authenticated-path gap is now *closed in executable form*: the client correctly consumes the atomic claim (removing the last post-claim failure mode), and both remaining live verifications are one command away given a single operator-provided artifact each. No security posture changed; the diff is strictly a robustness improvement plus probes. The `@ts-nocheck` campaign (24 files) remains the long-term quality backlog, ratcheted so it cannot grow.
