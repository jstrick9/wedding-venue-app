# Review #271 — Live Verification: Migrations 0018 + 0019 + 0020 Applied (Phase 3)

**Date:** 2026-09-01 · **Scope:** post-apply live proof that the three operator-run migrations took effect and broke nothing · **Method:** publishable-key probes only — INSERT `{}` discriminator, dummy-token RPC calls (token-gated functions return `not_found` before any write), known-revoked control calibration · **Mutations: NONE** (every probe was either denied, or short-circuited by token validation)

## Probe-signal taxonomy (recorded for future sessions)

| Signal | Meaning |
|---|---|
| 404 `PGRST202` "no matches … in the schema cache" | Function invisible to the calling role (dropped, or never granted) |
| 401 `42501` "permission denied for function X" | Function **exists** but EXECUTE revoked — the cleaner signal for "present but internal-only" |
| 401 `42501` "new row violates row-level security policy" | Table INSERT stopped by RLS WITH CHECK (the intended denial) |
| 400 `23502` NOT NULL violation | INSERT **passed** RLS — investigate |
| 400 `P0001` | BEFORE-trigger raise (gates run ahead of RLS) |

## 0018 (Review #258 — RPC audit, guest/couple surface): VERIFIED LIVE

| Probe (anon key) | Result | Verdict |
|---|---|---|
| `get_couple_portal_snapshot_unchecked(p_token)` | 401 `42501 permission denied` | ✓ F-258-1 revoke live |
| `get_guest_couple_portal_snapshot_unchecked(p_couple_id, p_guest_token)` | 401 `42501 permission denied` | ✓ revoke live |
| `submit_guest_couple_rsvp_unchecked(…)` | 404 `PGRST202` | ✓ **dropped** (orphan eliminated) |
| `save_couple_portal_snapshot_unchecked(p_token, p_payload, p_base_updated_at)` | 401 `42501 permission denied` | ✓ new 3-arg internal writer is anon-revoked |

## 0019 (Review #261 — geocode rate slot): VERIFIED LIVE

`geocode_try_acquire_slot()` → 401 `42501 permission denied`. F-261-1's anon-executable rate-slot starvation is closed; **no slot was acquired by the probe** (denied before execution — no mutation to log). Service role keeps default-privileges EXECUTE for the Edge Function.

## 0020 (Review #262 — audit_logs RLS): VERIFIED LIVE — F-262-1 CLOSED

Anon `INSERT {} → audit_logs` now returns **401 `42501 "new row violates row-level security policy"`**. The pre-fix live probe returned `23502` (NOT NULL on `action` — i.e. it had *passed* RLS). The flip to 42501 proves the null-org free pass is gone: anon can no longer forge org-less audit rows, and org-less SELECT is now platform_support-only. No row was written.

## Regression pass — anon-critical surface INTACT (all `200` with expected denials)

`get_couple_portal_snapshot`, `get_guest_couple_portal_snapshot`, both `_for_venue` variants, `save_couple_portal_snapshot`, `save_couple_portal_snapshot_for_venue` (probed with 2 named args — confirms the new `p_base_updated_at`-defaulted signature resolves existing client calls), `submit_guest_rsvp` (11-arg + caps live), `submit_guest_couple_rsvp` (payload cap live), `get_public_venue_branding` — all returned `{"ok":false,"error":"not_found" | "venue_not_found"}` as designed.

## Grant-map spot checks

- `upsert_couple_portal_snapshot` → 404 hidden from anon ✓ (auth-only cell holds).
- `get_platform_console_metrics` → 200 `{"ok":false,"error":"forbidden"}` — refines the recorded grant map: EXECUTE is anon-granted with an **in-body role gate** (not anon-hidden). Denial is correct and the #262 platform-column verdict stands; noting the nuance so future sessions don't misread the signal.
- `platform_venue_messages` INSERT `{}` → 400 `P0001 "caller is not allowed to post platform chat"` ✓ (#262 matrix stability — trigger gating unchanged).

## Disposition

**Migrations 0018 + 0019 + 0020: applied and live-verified.** Phase 3 anon column now fully closed against the live project. Remaining Phase 3 work is unchanged: venue/platform **authenticated** sign-in proof — still gated on request 3.1 artifacts (throwaway venue-admin invite claim + plain sign-up + `platform_memberships` grant, all staged in review #262). Live claim/RSVP E2E journeys (registry 8.x) remain deferred pending throwaway portal artifacts.
