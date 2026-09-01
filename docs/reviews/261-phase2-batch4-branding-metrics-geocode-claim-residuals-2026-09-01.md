# Review #261 — Phase 2 Batch 4 (final): branding, metrics, geocode, claim-flow residuals (units 2.2, 2.3, 2.6, 2.12, 2.13, 2.14, 2.15, 2.27, 2.44, 2.45, 2.46) — **PHASE 2 COMPLETE**

**Date:** 2026-09-01 · **Mode:** continuous campaign · One finding (F-261-1, fixed in migration 0019); everything else clean.

**Live anon probes (all read-safe or gated):** `get_platform_console_metrics` → `forbidden` ✓ · `get_public_platform_branding` → branding payload (public by design) ✓ · `get_public_venue_branding('bogus')` → `venue_not_found` ✓ · `get_venue_admin_invite_context('bogus')` → `not_found` ✓ · `geocode_try_acquire_slot()` → **`true` — the anon probe acquired the Nominatim rate slot** (the finding below).

**Live mutation log (per operating rules):** exactly one rate-slot acquisition by the F-261-1 probe — a single `last_request_at = now()` write on the `venue_geocode_rate` singleton, throttling geocoding for ≤1.1s. No other live writes this session.

## Finding

**F-261-1 (P3 grant hygiene, live-proven): `geocode_try_acquire_slot` was executable by anyone.** The function is the server-side Nominatim rate slot (`insert … on conflict do update … where last_request_at <= now() - 1.1s` — an elegant atomic acquire), consumed by the `geocode-venue` Edge Function before any external call. It was never revoked from public/anon/authenticated, so an attacker could poll it at ~1 req/1.1s and starve the platform's geocoding: address-quality features would silently degrade to never-geocoded. **Fixed in `0019_review_261_revoke_geocode_rate_slot.sql`** using the 0017 service-only revoke pattern (`from public, anon, authenticated`); the service role keeps its Supabase default-privileges grant, so the Edge Function is unaffected.

## Unit verdicts

- **2.2 `accept_venue_admin_invite` (0017:253)** — CLEAN. `auth.uid()` gate, `FOR UPDATE` on the invite, the #247 idempotent re-accept branch (Edge Function consumed the invite → client-side accept still succeeds), expiry + org-status gates, ownership transfer semantics, audit row.
- **2.3 `claim_venue_admin_account` (0017:125)** — CLEAN, exemplary. `FOR UPDATE` serialization, same-user idempotent re-claim (`already_claimed`), email match, org-status gate, previous-owner demotion, attempt-row cleanup, audit row, `unique_violation` handler. Service-only (revoked 0017; Edge Function only).
- **2.6 `geocode_try_acquire_slot` (0010:304)** — F-261-1 (above). Logic itself is a textbook atomic rate-slot; the defect was exposure, now revoked.
- **2.12 `get_platform_console_metrics` (0011:374)** — CLEAN. `is_platform_admin` gate; 0011's `greatest(relational, projection)` counting reconciles the two write paths; read-only.
- **2.13 `get_public_platform_branding` (0009:43)** — CLEAN. Returns the platform login branding (intentionally public; the login screen needs it before any auth).
- **2.14 `get_public_venue_branding` (0013:6)** — CLEAN. Slug-validated, returns only public branding fields (name/tagline/contact/colors/fonts/login background) with neutral defaults; org status is returned so clients can gate. Declined (P5): suspended venues' login branding remains readable — the login page must render for the "venue unavailable" message, and only branding fields leak.
- **2.15 `get_venue_admin_invite_context` (0015:17)** — CLEAN residual. Token ≥16, pending-only, expiry, suspended/archived gate; minimal context for the pre-auth claim screen. #245/#246/#248 semantics confirmed on the current definition.
- **2.27 `register_venue_admin_claim_failure` (0017:72)** — CLEAN residual. `FOR UPDATE` on the attempt row, rolling 1-hour window, 10 failures → 15-minute lock, insert race handled by `on conflict do nothing`. Service-only (revoked).
- **2.44 `upsert_couple_portal_snapshot` (0005:60)** — CLEAN. Venue-side writer: `auth.uid()` + `has_org_role(owner/admin/planner)`, couple/token validation, collaborator tokens stored only as sha256 hashes, atomic upsert (idempotent). Declined (P4): unbounded `p_payload` — same rationale as `sync_couple_projection` (#260): the caller is an authenticated venue member and the identical data lands in `org_data` under the same roles.
- **2.45 `upsert_platform_branding` (0009:62)** — CLEAN. `is_platform_admin` gate, atomic upsert, audit row including the payload.
- **2.46 `venue_admin_claim_gate` (0017:41)** — CLEAN residual. Lock check only, no writes, service-only (revoked).

## Pinned by

`src/services/platform/rpcAuditServiceOnly.test.ts` (2 tests): the 0019 revoke statement exists; the migration grants nothing to client roles.

## Gates

tsc + strict unused-locals scan clean (non-test) · eslint 0 errors / 30 warnings · vitest **1037 passed** / 5 skipped (+2) · single-file 546.51 kB gzip + split chunks within budget · audit clean.

## Live application (operator handoff)

Migrations **0018 and 0019** are committed but **not applied live** (revokes/drops are administrative SQL → operator-run per the live-throwaway rules). After applying, the audit's probe set re-runs clean: all four `_unchecked` RPCs and `geocode_try_acquire_slot` should hide with PGRST202 for the anon key.

## Phase 2 closed

46/46 RPCs audited against the full checklist. Totals: **6 findings** — F-258-1 (P1 orphaned `*_unchecked` RPCs), F-258-2 (P2 snapshot CAS), F-258-3 (P3 RSVP duplicate rows), F-258-4 (P3 unbounded anon input), F-261-1 (P3 geocode slot exposure), plus the date-rotted test fixture — and ~20 declined P4/P5 notes with written reasons. 37 of 46 functions passed clean; the platform's SQL discipline (security-definer + internal gates + audit logs on every admin mutation) held up well — the defects clustered around *exposure* (grants) and *concurrency* (CAS/locking), exactly where the checklist pointed.

## Registry delta

Rows 2.2, 2.3, 2.6, 2.12, 2.13, 2.14, 2.15, 2.27, 2.44, 2.45, 2.46 → `done`. **Phase 2: 46/46 — COMPLETE.** Next: Phase 3 (authorization proof matrix, 29 tables × 5 role classes).
