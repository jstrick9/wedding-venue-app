# Coverage Registry — the finite definition of "everything"

**Protocol:** `docs/qa/defect-elimination-protocol.md` (v1.0) · **Mode:** continuous · **Test env:** live + throwaway data
**Legend:** `open` → not yet examined · `in-progress` → unit started · `done` → examined, findings fixed/declined with evidence · `certified` → previously proven (review # cited)
**Rule:** a row may only move to `done`/`certified` with evidence (review # + what was proven). "Declined" findings need a written reason. This file is the single source of truth for campaign state; session review docs cite registry deltas.

**Phase 1 progress: 0/24 files retyped (ratchet ceiling must equal the open count).**

---

## A. Phase 1 — type de-blinding (24 files, 17,096 lines)

Order: shared foundation first, then by size (bug density). Every unit: remove `@ts-nocheck` → triage every `tsc` error as candidate bug → fix → gates → lower ratchet by the number of files closed.

| # | File | Lines | Status | Evidence |
|---|------|------:|--------|----------|
| 1.1 | components/admin/shared/AdminSharedComponents.tsx | 261 | open | — |
| 1.2 | components/admin/UserManagement.tsx | 1825 | open | — |
| 1.3 | components/admin/BrandingManagement.tsx | 1716 | open | — |
| 1.4 | components/admin/FixtureManagement.tsx | 1383 | open | — |
| 1.5 | components/admin/VenueManagement.tsx | 1162 | open | — |
| 1.6 | components/admin/TableManagement.tsx | 1161 | open | — |
| 1.7 | components/VenueDashboard.tsx | 957 | open | — |
| 1.8 | components/admin/ChairManagement.tsx | 876 | open | — |
| 1.9 | components/admin/WallManagement.tsx | 803 | open | — |
| 1.10 | components/admin/SpacingManagement.tsx | 792 | open | — |
| 1.11 | components/admin/TemplateManagement.tsx | 770 | open | — |
| 1.12 | components/admin/LinenManagement.tsx | 731 | open | — |
| 1.13 | components/VenueCalendar.tsx | 713 | open | — |
| 1.14 | components/admin/GuidelineManagement.tsx | 697 | open | — |
| 1.15 | components/admin/AccessControlPanel.tsx | 609 | open | — |
| 1.16 | components/VenueChatPanel.tsx | 595 | open | — |
| 1.17 | components/admin/OperationsSettingsManagement.tsx | 436 | open | — |
| 1.18 | components/admin/SecurityAuditManagement.tsx | 345 | open | — |
| 1.19 | components/admin/CommunicationTemplatesManagement.tsx | 345 | open | — |
| 1.20 | components/CoupleLayoutEditor.tsx | 310 | open | — |
| 1.21 | components/VendorPanel.tsx | 296 | open | — |
| 1.22 | components/CoupleLayoutPreview.tsx | 207 | open | — |
| 1.23 | components/admin/SeatingAndLinensManagement.tsx | 55 | open | — |
| 1.24 | components/admin/StructuresManagement.tsx | 51 | open | — |

## B. Phase 2 — RPC audit (46 functions)

Per unit checklist: input validation/limits · authz derivation · row locking on read-modify-write · idempotency · error contract · grant hygiene · audit coverage. (`*` = service-only or trigger/internal — checklist applies with "who can call it" as the first question.)

| # | RPC | Status | Evidence |
|---|-----|--------|----------|
| 2.1 | accept_invite | open | — |
| 2.2 | accept_venue_admin_invite | done (re-audit for residual issues in Phase 2 pass) | #247 (idempotent branch); 0015 original |
| 2.3 | claim_venue_admin_account | done (re-audit for residual issues) | #247 + live E2E throttle/claim probes |
| 2.4 | create_venue_organization | open | — |
| 2.5 | create_venue_organization_v | open | — (superseded variant? verify dead code) |
| 2.6 | geocode_try_acquire_slot | open | — |
| 2.7 | get_couple_portal_snapshot | open | — |
| 2.8 | get_couple_portal_snapshot_for_venue | open | — |
| 2.9 | get_guest_by_portal_token | open | — |
| 2.10 | get_guest_couple_portal_snapshot | open | — |
| 2.11 | get_guest_couple_portal_snapshot_for_venue | open | — |
| 2.12 | get_platform_console_metrics | open | — |
| 2.13 | get_public_platform_branding | open | — |
| 2.14 | get_public_venue_branding | open | — |
| 2.15 | get_venue_admin_invite_context | done (re-audit for residual issues) | #245/#246/#248 semantics documented |
| 2.16 | handle_new_user * | open | — |
| 2.17 | has_org_role * | open | — |
| 2.18 | has_platform_role * | open | — |
| 2.19 | is_event_member * | open | — |
| 2.20 | is_org_member * | open | — |
| 2.21 | is_platform_admin * | open | — |
| 2.22 | is_platform_support * | open | — |
| 2.23 | org_data_array_len * | open | — |
| 2.24 | org_data_write_allowed * | open | — |
| 2.25 | prevent_organization_slug_change * | open | — |
| 2.26 | reactivate_venue_organization | open | — |
| 2.27 | register_venue_admin_claim_failure * | done (re-audit residual) | #247 |
| 2.28 | reissue_venue_admin_invite | open | — |
| 2.29 | revoke_venue_admin_invite | open | — |
| 2.30 | save_couple_portal_snapshot | open | — |
| 2.31 | save_couple_portal_snapshot_for_venue | open | — |
| 2.32 | set_couple_snapshot_updated_at * | open | — |
| 2.33 | set_org_data_updated_at * | open | — |
| 2.34 | set_platform_chat_sender_side * | open | — |
| 2.35 | set_updated_at * | open | — |
| 2.36 | snapshot_guest_token_expires_at * | open | — |
| 2.37 | snapshot_token_expires_at * | open | — |
| 2.38 | submit_guest_couple_rsvp | done (re-audit residual: locking verified, rest of checklist pending) | #245 P1-C fix, 0016 |
| 2.39 | submit_guest_couple_rsvp_for_venue | open | — |
| 2.40 | submit_guest_rsvp | open | — |
| 2.41 | suspend_venue_organization | open | — |
| 2.42 | sync_couple_projection * | open | — |
| 2.43 | update_venue_organization | open | — |
| 2.44 | upsert_couple_portal_snapshot | open | — |
| 2.45 | upsert_platform_branding | open | — |
| 2.46 | venue_admin_claim_gate * | done (re-audit residual) | #247 + live 429 proof |

## C. Phase 3 — authorization proof matrix (29 tables × 5 role classes)

Anon column largely certified for the core 16 tables (#246/#247); re-verify stragglers and fill guest/couple/venue/platform columns via live sessions (see request board). Verdict per cell: `certified` (evidence) / `denied-by-RLS` (evidence) / `n-a` (not a client-reachable table).

| Table | anon | guest | couple | venue | platform |
|------|------|-------|--------|-------|----------|
| audit_logs | open | n-a? | n-a? | open | open |
| couple_portal_snapshots | open | open | open | open | open |
| event_answers | open | open | open | open | open |
| event_memberships | open | open | open | open | open |
| event_questions | open | open | open | open | open |
| events | open | open | open | open | open |
| guest_portal_configs | open | open | open | open | open |
| guests | open | open | open | open | open |
| layout_versions | open | open | open | open | open |
| layouts | open | open | open | open | open |
| org_data | certified #246 | n-a? | n-a? | open | open |
| org_invites | open | n-a? | n-a? | open | open |
| organization_memberships | open | n-a? | n-a? | open | open |
| organizations | open | n-a? | open | open | open |
| platform_audit_logs | open | n-a? | n-a? | open | open |
| platform_chat_read_markers | open | open | open | open | open |
| platform_memberships | certified #246 | n-a? | n-a? | open | open |
| platform_settings | open | n-a? | n-a? | open | open |
| platform_venue_messages | certified #246 (trigger) | open | open | open | open |
| profiles | open | open | open | open | open |
| rsvp_submissions | open | open | open | open | open |
| staff_tasks | open | open | open | open | open |
| timeline_events | open | open | open | open | open |
| vendors | open | open | open | open | open |
| venue_admin_claim_attempts | certified #247 (RLS-hidden) | n-a | n-a | n-a | n-a |
| venue_admin_invites | certified #246 | n-a? | n-a? | open | open |
| venue_geocode_cache | open | n-a? | n-a? | open | open |
| venue_geocode_rate | open | n-a? | n-a? | open | open |
| venues | open | open | open | open | open |

## D. Phase 4 — console flow audit

| # | Console / flow | Hotspot files | Status |
|---|----------------|---------------|--------|
| 4.1 | Platform console: venue create → invite → reissue → suspend/reactivate | PlatformAdminPortal, AdminPanel | open |
| 4.2 | Platform console: metrics, branding, settings, chat | get_platform_console_metrics path | open |
| 4.3 | Venue onboarding/claim (end-to-end) | VenueAdminOnboarding | harness ready (#248), run pending |
| 4.4 | Venue dashboard | VenueDashboard (957) | open (pairs with 1.7) |
| 4.5 | Venue calendar | VenueCalendar (713) | open (pairs with 1.13) |
| 4.6 | Venue chat | VenueChatPanel (595) | open (pairs with 1.16) |
| 4.7 | Venue floor plan / layouts | FloorPlanCanvas (1890), layouts, layout_versions | open |
| 4.8 | Venue admin panels (19 management screens) | admin/* | open (pairs with A.2–A.6, A.8–A.12, A.14–A.19, A.23–A.24) |
| 4.9 | Venue operations: staff tasks, vendors, timeline | StaffOperationsPanel (2061), VendorPanel | open |
| 4.10 | Couple portal: view, RSVP, layout editor/preview | CouplesPortal (3930), CoupleLayoutEditor/Preview | open |
| 4.11 | Guest portal: view, submit RSVP | GuestPortal (2414) | open |
| 4.12 | Auth/session lifecycle: sign-in, restore, sign-out, role routing | AuthBackend, session persistence | open |
| 4.13 | Event-bus + store correctness (cross-console) | event bus, stores, hooks (20) | open |

## E. Edge Functions (3)

| # | Function | Status | Notes |
|---|----------|--------|-------|
| 5.1 | claim-venue-admin | done (re-audit residual: input limits, abuse beyond token throttle) | #247/#248 |
| 5.2 | geocode-venue | open | bearer-auth confirmed #246; validate inputs, rate limits, Geoapify error paths |
| 5.3 | send-email | open | bearer-auth confirmed #246; abuse limits (spam via authenticated callers?) |

## F. Cross-cutting sweeps

| # | Sweep | Status |
|---|-------|--------|
| 6.1 | Event-bus / subscription listener leaks (mount-unmount cycles) | open |
| 6.2 | Unhandled promise rejections + async error swallowing | open |
| 6.3 | Conditional-hooks correctness (7 files flagged #245) | open |
| 6.4 | Race conditions in client stores (optimistic updates, cache invalidation) | open |
| 6.5 | Loading/error/empty-state completeness per screen | open (pairs with D) |
| 6.6 | Oversized/adversarial input handling on every externally-reachable field | open |
| 6.7 | Secrets & env hygiene sweep (no keys client-side; Edge env expectations documented) | open |
| 6.8 | Dead code / superseded paths (e.g. create_venue_organization_v) | open |

## G. Drift & config

| # | Check | Status |
|---|-------|--------|
| 7.1 | Live schema fingerprint vs migrations 0001–0017 | open (0016/0017 applied 2026-08-31; full re-fingerprint pending) |
| 7.2 | Storage: MIME allowlist + per-bucket policies | certified #247 (public-branding); other buckets open |
| 7.3 | Grants fingerprint (function execute grants vs intended callers) | open |
| 7.4 | Edge Function env vars + CORS posture (known #245 note) | open |

## H. E2E journeys (browser-level, after Phase 5 harness)

| # | Journey | Status |
|---|---------|--------|
| 8.1 | Platform → create venue → invite → claim → first sign-in | harness ready, run deferred #248 |
| 8.2 | Claim → configure → couple portal publish → guest RSVP → venue sees submission | open |
| 8.3 | Reissue invite → password reset → old sessions | open |
| 8.4 | Suspend venue → each console's behavior | open |
| 8.5 | Concurrent RSVP race (two guests, one couple) | harness ready, run deferred #248 |
| 8.6 | Guest token expiry / access window edges | open |

---

## Artifact request board (live-throwaway mode — batched, not per-unit)

*Provision when convenient; I'll pick these up and keep sessions/cleanable state for them.*

| Artifact | Needed by | Status |
|----------|-----------|--------|
| 1 pending venue-admin invite → throwaway email (setup-link token pasted here) | Phase 3 venue column + journey 8.1 | requested |
| 2 guest-portal tokens for the same couple + its couple id | journey 8.5, C rows | requested |
| 1 second invite → second throwaway email (cross-user negative tests) | Phase 3 (negative cells) | later |
| 1 throwaway venue you are willing to have suspended | 8.4 suspension paths | later |

**Session state:** *none yet — no live sessions created by the campaign so far.*
