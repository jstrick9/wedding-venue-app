# Review #258 — Phase 2 Batch 1: guest/couple public RPC cluster (units 2.7–2.11, 2.30, 2.31, 2.38, 2.39, 2.40)

**Date:** 2026-08-31/09-01 · **Mode:** continuous campaign · First Phase 2 batch: the anon-exposed guest/couple surface — the most attacked RPC cluster.

**Audit method:** per-unit checklist (input validation/limits · authz derivation · row locking · idempotency · error contract · grant hygiene · audit coverage) against each function's *effective* definition (last `create or replace` wins; 46-function inventory rebuilt from migrations). Grant claims verified **live** with read-only anon probes against bogus tokens (no writes).

## Findings

**F-258-1 (P1 — grant hygiene, live-proven): the 0008 rename left four `*_unchecked` RPCs executable by anyone.** Migration 0008 renamed the original couple-portal functions to `*_unchecked` and installed checked wrappers under the old names — but **RENAME preserves grants**, and nothing ever revoked the orphans. Live probe (anon key, bogus tokens): all four answered `{"ok":false,"error":"not_found"}` — the function bodies executed — while the control (revoked `claim_venue_admin_account`) correctly hid with PGRST202. Concretely:

- `submit_guest_couple_rsvp_unchecked` still carried the **pre-#245 body** — no `FOR UPDATE` (the lost-update race #245 fixed), no RSVP-deadline check — directly callable by anyone who knows it exists.
- `get_couple_portal_snapshot_unchecked`, `save_couple_portal_snapshot_unchecked`, `get_guest_couple_portal_snapshot_unchecked` bypass the suspended-organization gate their wrappers enforce.

**F-258-2 (P2 — lost update): the couple-side save had no compare-and-swap.** `save_couple_portal_snapshot(_for_venue)` replaced the whole payload with client-computed state; a guest submission landing between the couple's pull and push was silently dropped (the #245 row lock only serialized server-side writers — the couple's client-side read-modify-write was unprotected). The save functions now take an optional `p_base_updated_at` and refuse with `{'ok':false,'error':'conflict'}` when the row moved. Client wired end-to-end: `pullCouplePortalSnapshot` returns the row version, `saveCouplePortalSnapshot` forwards it, and `CouplesPortal` re-hydrates + retries once on conflict (the hydration merge preserves both sides). Old 2-arg calls keep working via the parameter default.

**F-258-3 (P3 — duplicate rows): `submit_guest_rsvp` had no lock and no unique backstop.** Delete+insert replacement with no `FOR UPDATE` while `rsvp_submissions` has no unique(guest_id) index → concurrent double-submits could leave two rows per guest. The guest row is now locked first (same pattern #245 applied to the couple path). A unique index was considered and deferred: other writers (couple-projection sync) insert with `source_submission_id`, and the lock already serializes the racing path.

**F-258-4 (P3 — unbounded input on anon RPCs):** legacy `submit_guest_rsvp` left `plus_one_name`/`plus_one_meal_choice`/`dietary_notes`/`special_needs`/`notes` and the `attending_days` entries unbounded; `submit_guest_couple_rsvp` embedded the whole jsonb submission with no size cap (storage/DoS vector — the payload is embedded into the snapshot array). Caps added (200/100/2000/2000/2000 chars, 30 chars per day, 20 KB per submission).

## Clean units

- **2.9 `get_guest_by_portal_token`** — token-hash authz, enabled check, length gate, returns a limited field set. Clean.
- **2.10 `get_guest_couple_portal_snapshot`** — token + hash + `allowPortalAccess` + both expiry helpers; strips `token` from the returned guest/rsvp objects. Clean.
- **2.39 `submit_guest_couple_rsvp_for_venue`** — thin wrapper: validates (slug, couple, active org) then delegates to the hardened function. Clean.

## Observations (declined, with reasons)

- `couple_portal_snapshots.payload` embeds plaintext guest tokens (the guest-match in the writers compares `token` directly). By design: the couple portal renders guest links and the guest readers strip tokens from responses. Changing the storage format is a data migration far beyond this unit's scope — recorded for Phase 7 drift review.
- No audit-log rows for guest RSVP submissions: the submission rows themselves are the record; nothing administrative happens. Declined.

## Remediation

`supabase/migrations/0018_review_258_rpc_audit_guest_couple_surface.sql` — revokes/drops the four orphans; CAS on the three save entry points (drop+recreate with the optional arg; old forms dropped, new ones granted explicitly, PostgREST resolves legacy named-arg calls via defaults); `FOR UPDATE` + full length caps in `submit_guest_rsvp`; 20 KB cap in `submit_guest_couple_rsvp`.

Client: `src/services/couples/coupleCloudSync.ts` (pull returns `{payload, updatedAt}`; save takes `baseUpdatedAt` and returns `'saved' | 'conflict' | 'error'`), `src/components/CouplesPortal.tsx` (tracks the synced version, passes it, re-hydrates + retries once on conflict).

Pinned by: `src/services/couples/rpcAuditGuestSurface.test.ts` (4 tests — revokes/drop, CAS clauses, lock, caps) and `src/services/couples/coupleCloudSync.cas.test.ts` (5 tests — version pull-through, conflict mapping, legacy no-base calls, slug variant).

## Test-infra note (not caused by this batch, fixed in it)

The full-suite run exposed a **date-rotted fixture** in `PlatformAdminPortal.test.tsx`: Hilltop Barn's pending invite expired `2026-09-01T00:00:00Z` and the UTC clock crossed it after the last green CI — the venue silently left the pending-invite queue and the deep-link test failed on an untouched tree (verified by stashing the batch). Both invite fixtures now use relative future dates via a `futureIso(days)` helper.

## Gates

tsc + strict unused-locals scan clean (non-test) · eslint 0 errors / 30 warnings · vitest **1035 passed** / 5 skipped (+9) · single-file 546.51 kB gzip + split chunks within budget · audit clean. @ts-nocheck ratchet ceiling 0 (unchanged).

## Live application (operator handoff)

Migration 0018 is committed but **not applied to the live project** (revokes/drops are administrative SQL → operator-run per the campaign's live-throwaway rules). After applying (`supabase db push` or pasting the file into the SQL editor), the F-258-1 fix can be verified with the same probe: all four `_unchecked` RPCs should hide with PGRST202 for the anon key.

## Registry delta

Rows 2.7, 2.8, 2.9, 2.10, 2.11, 2.30, 2.31, 2.38, 2.39, 2.40 → `done`. Also verified: registry row 2.5's `create_venue_organization_v` is actually `create_venue_organization_v2` (0014). Phase 2: 10/46. Next batch: org lifecycle + invite management RPCs (2.1, 2.4, 2.5, 2.26, 2.28, 2.29, 2.41, 2.43).
