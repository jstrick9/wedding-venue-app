# Coverage Registry — the finite definition of "everything"

**Protocol:** `docs/qa/defect-elimination-protocol.md` (v1.0) · **Mode:** continuous · **Test env:** live + throwaway data
**Legend:** `open` → not yet examined · `in-progress` → unit started · `done` → examined, findings fixed/declined with evidence · `certified` → previously proven (review # cited)
**Rule:** a row may only move to `done`/`certified` with evidence (review # + what was proven). "Declined" findings need a written reason. This file is the single source of truth for campaign state; session review docs cite registry deltas.

**Phase 1 progress: 24/24 files retyped — COMPLETE · ratchet ceiling 0 (#257): any new @ts-nocheck in a runtime file fails CI.**

---

## A. Phase 1 — type de-blinding (24 files, 17,096 lines)

Order: shared foundation first, then by size (bug density). Every unit: remove `@ts-nocheck` → triage every `tsc` error as candidate bug → fix → gates → lower ratchet by the number of files closed.

| # | File | Lines | Status | Evidence |
|---|------|------:|--------|----------|
| 1.1 | components/admin/shared/AdminSharedComponents.tsx | 261 | done | #249 typed; found 8 unimported type refs hidden by nocheck; mixed-adoption dedup note → 6.8 |
| 1.2 | components/admin/UserManagement.tsx | 1825 | done | #250: F-250-1 FileReader-shadow crash (profile-image upload), F-250-2 showInfo missing message arg; 267→~30-name destructure (57 invalid names incl. globals); NewUserDraft typed |
| 1.3 | components/admin/BrandingManagement.tsx | 1716 | done | #250: F-250-5 same FileReader-shadow crash in BOTH logo upload paths (the branding panel IS the upload surface); 265→~30-name destructure; select values cast into Config unions |
| 1.4 | components/admin/FixtureManagement.tsx | 1383 | done | #251: F-251-2 venue-category toggle computed value discarded (feature never worked); F-251-1 FixtureType.description type gap |
| 1.5 | components/admin/VenueManagement.tsx | 1162 | done | #251: clone-stamp garbage only (57 invalid + 197 unused names removed); no defects |
| 1.6 | components/admin/TableManagement.tsx | 1161 | done | #251: F-251-4 same discard bug — Venue Category Availability chips on tables never worked (blast radius of the clone: exactly 2 files, both fixed) |
| 1.7 | components/VenueDashboard.tsx | 957 | done | #251: F-251-6 MouseEvent passed as tab → garbage admin hash + tab event; F-251-5 badgeCount type lie (as-any casts); F-251-7 user/users any-typed |
| 1.8 | components/admin/ChairManagement.tsx | 876 | done | #252: clone-stamp garbage only (57 invalid + 202 unused); no defects |
| 1.9 | components/admin/WallManagement.tsx | 803 | done | #252: clone-stamp garbage only; no defects |
| 1.10 | components/admin/SpacingManagement.tsx | 792 | done | #252: F-252-1 (P1) — every control called AdminPanel-internal setSpacingSettings → ReferenceError; whole panel non-functional since creation; 12 sites now call the handleSaveSpacing prop |
| 1.11 | components/admin/TemplateManagement.tsx | 770 | done | #253: clean — 57 invalid + 197 unused names; missing LayoutTemplate type import added (annotation-only); 770→509 L |
| 1.12 | components/admin/LinenManagement.tsx | 731 | done | #253: clean — 57 invalid + 201 unused names; types import 16→0; 731→467 L |
| 1.13 | components/VenueCalendar.tsx | 713 | done | #253: F-253-1 (P1) — CalendarEventForm read out-of-scope `config` → ReferenceError on render; add/edit event form crashed on open; fixed via own useBrandingConfig() call. F-253-2 (P4) endTime never shown (EventItem lacked the field). Pinned by VenueCalendar.typing.test.ts |
| 1.14 | components/admin/GuidelineManagement.tsx | 697 | done | #254: clean — 57 invalid + 204 unused names (none used in body); types import 16→1; 697→429 L |
| 1.15 | components/admin/AccessControlPanel.tsx | 609 | done | #254: clean — hierarchy-optional guard (semantics preserved); dead copy-permissions handler + 4 unused names pruned; 609→601 L |
| 1.16 | components/VenueChatPanel.tsx | 595 | done | #255: clean — 0 tsc errors; dead showQuickReplies state (never read) + getConfig import pruned; 595→592 L |
| 1.17 | components/admin/OperationsSettingsManagement.tsx | 436 | done | #255: F-255-1 (P3) — destructured onShowSuccess but prop is showSuccess; all 5 action toasts never fired since creation (silent saves). Pinned by OperationsSettingsManagement.typing.test.ts |
| 1.18 | components/admin/SecurityAuditManagement.tsx | 345 | done | #256: F-256-1 (P3) — phantom onShowSuccess prop; all 5 action toasts (save settings, clear cache ×2, export CSV/JSON) never fired since creation; test fixture had codified the phantom name. Pinned |
| 1.19 | components/admin/CommunicationTemplatesManagement.tsx | 345 | done | #256: F-256-1 (P3) same phantom prop (5 sites) + F-256-2 (P3) — 'Save Wording Defaults' persisted nothing (edits lost on reload); now persists + loads. Pinned |
| 1.20 | components/CoupleLayoutEditor.tsx | 310 | done | #257: clean — 0 tsc errors, 0 strict violations; nothing pruned |
| 1.21 | components/VendorPanel.tsx | 296 | done | #257: clean — unused VendorCategoryDef type import pruned; no defects |
| 1.22 | components/CoupleLayoutPreview.tsx | 207 | done | #257: clean — 0 tsc errors, 0 strict violations |
| 1.23 | components/admin/SeatingAndLinensManagement.tsx | 55 | done | #249 typed, no defects |
| 1.24 | components/admin/StructuresManagement.tsx | 51 | done | #249 typed, no defects |

## B. Phase 2 — RPC audit (59 functions after migration 0022)

**Phase 2 progress: original 46/46 — COMPLETE (#261). Migrations 0018–0020 are applied and live-verified (#271); migration 0021 is applied and its 11 account-binding/internal-wrapper functions are audited and locally behavior-verified (#273). Migration 0022 adds two service-only recovery functions, both audited and behavior-verified in PGlite (#274), with production application pending. Current finite inventory: 59/59 examined.**

Per unit checklist: input validation/limits · authz derivation · row locking on read-modify-write · idempotency · error contract · grant hygiene · audit coverage. (`*` = service-only or trigger/internal — checklist applies with "who can call it" as the first question.)

| # | RPC | Status | Evidence |
|---|-----|--------|----------|
| 2.1 | accept_invite | done | #259: clean — token+pending+expiry; auth.uid() AND JWT-email-match (exemplary); benign lockless race converges via on-conflict upsert |
| 2.2 | accept_venue_admin_invite | done | #261 residual: auth.uid + FOR UPDATE + idempotent re-accept + expiry/org gates + audit — clean |
| 2.3 | claim_venue_admin_account | done | #261 residual: exemplary — FOR UPDATE, idempotent re-claim, email match, audit, unique_violation handler |
| 2.4 | create_venue_organization | done | #259: clean but superseded (client uses v2); kept — admin-gated, audited, handles unique_violation |
| 2.5 | create_venue_organization_v2 | done | #259: clean — full validation, immutable slug, audit row; P5 notes (slug-race 500, unbounded name) declined w/ reasons |
| 2.6 | geocode_try_acquire_slot | done | #261: F-261-1 (P3) — anon-executable rate slot could starve platform geocoding (live-proven: probe acquired slot); revoked in 0019 |
| 2.7 | get_couple_portal_snapshot | done | #258: wrapper authz ok (token/collab + active org); delegation target _unchecked was anon-callable (F-258-1) — revoked in 0018 |
| 2.8 | get_couple_portal_snapshot_for_venue | done | #258: slug-scoped wrapper, delegates to checked getter; clean |
| 2.9 | get_guest_by_portal_token | done | #258: clean — token-hash authz, enabled check, limited field set |
| 2.10 | get_guest_couple_portal_snapshot | done | #258: clean — token/hash/allowPortalAccess + dual expiry checks; strips tokens from responses |
| 2.11 | get_guest_couple_portal_snapshot_for_venue | done | #258: thin wrapper over checked getter; clean |
| 2.12 | get_platform_console_metrics | done | #261: clean — is_platform_admin gate, greatest(relational,projection) counting |
| 2.13 | get_public_platform_branding | done | #261: clean — public login branding by design |
| 2.14 | get_public_venue_branding | done | #261: clean — slug-validated, branding-only fields, neutral defaults; suspended-org readability P5 declined |
| 2.15 | get_venue_admin_invite_context | done | #261 residual: clean — pending-only, expiry, org-status gate; minimal pre-auth context |
| 2.16 | handle_new_user * | done | #260: clean — trigger on auth.users, idempotent profile insert; returns trigger → not RPC-invocable |
| 2.17 | has_org_role * | done | #260: clean — security-definer RLS predicate on auth.uid(); grant required for RLS evaluation |
| 2.18 | has_platform_role * | done | #260: clean — same pattern vs platform_memberships |
| 2.19 | is_event_member * | done | #260: clean — org-member OR active event-membership |
| 2.20 | is_org_member * | done | #260: clean — membership lookup keyed on auth.uid(); anon probe → false |
| 2.21 | is_platform_admin * | done | #260: clean — role-array wrapper; anon probe → false |
| 2.22 | is_platform_support * | done | #260: clean — role-array wrapper |
| 2.23 | org_data_array_len * | done | #260: clean — pure immutable jsonb computation, no table access |
| 2.24 | org_data_write_allowed * | done | #260: clean — #180 admin-domain allowlist + has_org_role; wired into all org_data write policies |
| 2.25 | prevent_organization_slug_change * | done | #260: clean — trigger raising organization_slug_immutable |
| 2.26 | reactivate_venue_organization | done | #259: clean — owner-aware status, clears suspension fields, audited |
| 2.27 | register_venue_admin_claim_failure * | done | #261 residual: clean — FOR UPDATE, rolling window, 10→15min lock; service-only |
| 2.28 | reissue_venue_admin_invite | done | #259: clean — org-state gate, validation, revoke-then-insert, audited; concurrent-reissue P5 declined |
| 2.29 | revoke_venue_admin_invite | done | #259: clean — atomic UPDATE..RETURNING, no TOCTOU, audited |
| 2.30 | save_couple_portal_snapshot | done | #258: F-258-2 (P2) whole-payload save lost concurrent guest writes — CAS via p_base_updated_at + client conflict-retry (0018) |
| 2.31 | save_couple_portal_snapshot_for_venue | done | #258: F-258-2 CAS inherited via shared internal writer (0018) |
| 2.32 | set_couple_snapshot_updated_at * | done | #260: clean — updated_at trigger; returns trigger → not RPC-invocable |
| 2.33 | set_org_data_updated_at * | done | #260: clean — updated_at trigger |
| 2.34 | set_platform_chat_sender_side * | done | #260: clean — server-side sender derivation, raises for non-members (#180 N-6) |
| 2.35 | set_updated_at * | done | #260: clean — updated_at trigger |
| 2.36 | snapshot_guest_token_expires_at * | done | #260: clean — pure expiry derivation from caller-supplied payload |
| 2.37 | snapshot_token_expires_at * | done | #260: clean — pure expiry derivation (collaborator-specific + event fallback) |
| 2.38 | submit_guest_couple_rsvp | done | #258 residual: locking ✓ (#245), deadline ✓ (0016); F-258-4 20 KB payload cap added (0018) |
| 2.39 | submit_guest_couple_rsvp_for_venue | done | #258: thin wrapper (slug+couple+active-org gate) delegating to the hardened function; clean |
| 2.40 | submit_guest_rsvp | done | #258: F-258-3 (P3) no lock/no unique(guest_id) → duplicate rows — FOR UPDATE added; F-258-4 unbounded text fields capped (0018) |
| 2.41 | suspend_venue_organization | done | #259: clean — atomic, cascades invite revocation, audited; double-suspend overwrite P5 declined |
| 2.42 | sync_couple_projection * | done | #260: clean — org-role gate, idempotent on-conflict upserts, sha256-only tokens; P4 unbounded-payload note declined |
| 2.43 | update_venue_organization | done | #259: clean — 14-field validation, immutable slug, audit w/ previous status; unlocked read P5 declined |
| 2.44 | upsert_couple_portal_snapshot | done | #261: clean — role-gated venue writer, hashed tokens, idempotent upsert; P4 unbounded payload declined |
| 2.45 | upsert_platform_branding | done | #261: clean — is_platform_admin gate, audit row w/ payload |
| 2.46 | venue_admin_claim_gate * | done | #261 residual: clean — lock check only, no writes, service-only |
| 2.47 | refresh_couple_portal_invite_hashes * | done (deployed; live behavior pending) | #273: trigger-only hash refresh + backfill; internal execute revoked; keeps primary/collaborator hashes synchronized after every payload write |
| 2.48 | get_portal_invite_context | done (deployed; live behavior pending) | #273: bounded token/context lookup; minimal fields only; expiry/revocation/org gates; durable account identity wins over stale snapshot email |
| 2.49 | accept_portal_invite_internal * | done (deployed; live behavior pending) | #273: service/internal only; participant advisory lock + post-lock context re-resolution; canonical email and existing-account conflict checks; direct client execute revoked |
| 2.50 | accept_portal_invite | done (deployed; live behavior pending) | #273: authenticated wrapper derives `auth.uid()` + JWT email; delegates atomically; anonymous claim cannot call it |
| 2.51 | claim_portal_invite_account * | done (deployed; live behavior pending) | #273: service-role wrapper for newly created Auth users; same locked transaction; direct anon/authenticated execute revoked |
| 2.52 | get_couple_portal_snapshot_token_impl * | done (deployed; live behavior pending) | #273: renamed historical token implementation; callable only through account-aware public wrapper; PUBLIC/anon/authenticated execute revoked |
| 2.53 | save_couple_portal_snapshot_token_impl * | done (deployed; live behavior pending) | #273: preserves #258 CAS writer behind account-aware wrapper; direct execute revoked |
| 2.54 | get_guest_couple_portal_snapshot_token_impl * | done (deployed; live behavior pending) | #273: historical compatibility implementation behind account-aware wrapper; direct execute revoked |
| 2.55 | submit_guest_couple_rsvp_token_impl * | done (deployed; live behavior pending) | #273: historical compatibility implementation behind account-aware wrapper; direct execute revoked |
| 2.56 | get_guest_by_portal_token_token_impl * | done (deployed; live behavior pending) | #273: relational token implementation gated by account-aware public function; direct execute revoked |
| 2.57 | submit_guest_rsvp_token_impl * | done (deployed; live behavior pending) | #273: locked/validated relational RSVP implementation gated by account-aware public function; direct execute revoked |
| 2.58 | begin_password_reset_request * | done (local; production pending) | #274: service-only, hash-only audit rows; global → requester → email advisory-lock order; atomic rolling-window throttles; anon/authenticated execute revoked; PGlite ACL/throttle behavior passed |
| 2.59 | get_password_reset_account_context * | done (local; production pending) | #274: service-only canonical account lookup; active surface membership required; venue status enforced; minimal server-derived delivery context; anon/authenticated execute revoked; PGlite eligibility behavior passed |

## C. Phase 3 — authorization proof matrix (31 tables × 5 role classes after migration 0022)

**Method (#262/#273/#274):** the original 29-table deployed-schema anon column was live-proven with the publishable key; guest/couple data uses security-definer RPCs. Migration 0021 is applied and adds `portal_accounts` as table 30; its policy/ACL behavior is PGlite-proven (#273), with account-journey live proof pending. Migration 0022 adds deny-by-default `password_reset_requests` as table 31; its RLS/ACL behavior is PGlite-proven (#274), with production application pending. Venue/platform cells otherwise remain policy-derived except the #272 live venue-claim coverage. Verdicts: `certified` (live evidence) / `policy` (derived from inventory, live proof pending) / `n-a`.

Legend per cell below: `live` = live-proven this phase · `pol` = policy-derived · `svc` = service-role only (no policies → deny-all for client roles).

| Table | anon | guest | couple | venue | platform |
|------|------|-------|--------|-------|----------|
| audit_logs | **F-262-1 (P3) fixed in 0020**: null-org rows were anon-readable/writable (live: INS passed RLS, 23502); post-0020 denied — apply live | n-a | n-a | pol: admin select / member insert (org-scoped) | pol: support reads org-less rows |
| couple_portal_snapshots | live: denied (INS 42501, GET empty) | RPC-only (#258): token-gated read/RSVP | RPC-only (#258): token-gated get/save + CAS | pol: owner/admin/planner select + all | pol: via org tables; RPC-only otherwise |
| event_answers | live: denied | n-a | n-a | pol: event-member select/all | n-a |
| event_memberships | live: denied | n-a | n-a | pol: event-member select; owner/admin/planner manage | pol: platform admin all |
| event_questions | live: denied | n-a | n-a | pol: member select; owner/admin/planner manage | n-a |
| events | live: denied | RPC-only (#258 snapshot payloads) | RPC-only (#258) | pol: member select; owner/admin/planner manage | pol: platform admin all |
| guest_portal_configs | live: denied | RPC-only (#258/0010 window+deadline enforced server-side) | n-a | pol: member select; owner/admin/planner manage | n-a |
| guests | live: denied | RPC-only (#258): token-hash lookup, own record only | RPC-only (#258) | pol: member select; +staff manage | pol: via org tables |
| layout_versions | live: denied | n-a | n-a | pol: member select; owner/admin/planner/staff insert | n-a |
| layouts | live: denied | n-a | n-a | pol: member select; owner/admin/planner/staff manage | n-a |
| org_data | certified #246 + live re-proven #262 (GET empty, INS 42501) | n-a | n-a | pol: member read; write via org_data_write_allowed (admin domains gated) | pol: platform admin via RPCs |
| org_invites | live: denied | n-a | n-a | pol: owner/admin manage | pol: platform admin select |
| organization_memberships | live: denied | n-a | n-a | pol: member select self-org; owner/admin manage; self-signup owner insert | pol: platform admin all |
| organizations | live: denied | n-a | pol: branding/login via get_public_venue_branding only | pol: member/owner select; **intentional** self-serve insert (AuthBackend bootstrap, declined as finding) | pol: platform admin select/all |
| platform_audit_logs | live: denied (INS 42501) | n-a | n-a | n-a | pol: support select; support+auth.uid insert |
| platform_chat_read_markers | live: denied | n-a | n-a | pol: self (auth.uid) only | pol: self |
| platform_memberships | certified #246 + live re-proven #262 | n-a | n-a | n-a | pol: self select; admin all |
| platform_settings | live: denied | pol: public branding via get_public_platform_branding only | n-a | n-a | pol: admin select/all |
| platform_venue_messages | live: denied (INS reached trigger → P0001 raise; policy also requires auth.uid sender) | n-a | n-a | pol: member select + trigger-derived sender_side insert | pol: admin select/update; platform-side insert |
| portal_accounts *(0021 applied; live behavior pending)* | local #273: table denied; internal RPC ACLs deny anon | pol: authenticated invitee selects own mapping only | pol: authenticated invitee selects own mapping only | pol: owner/admin/planner select in own org | denied unless separately an org member |
| password_reset_requests *(0022 production pending)* | svc: RLS enabled, no policies; table + RPC execute revoked | svc | svc | svc | svc |
| profiles | live: denied | n-a | n-a | pol: self + same-org select; self insert/update | pol: admin select |
| rsvp_submissions | live: denied | RPC-only (#258): own submission, locked+validated | RPC-only (#258): snapshot submissions | pol: member select/insert; owner/admin/planner update | n-a |
| staff_tasks | live: denied | n-a | n-a | pol: member select; +staff manage | n-a |
| timeline_events | live: denied | n-a | n-a | pol: member select; +staff manage | n-a |
| vendors | live: denied | n-a | n-a | pol: member select; owner/admin/planner manage | n-a |
| venue_admin_claim_attempts | certified #247 (RLS-hidden) + live re-proven #262 | svc | svc | svc | svc |
| venue_admin_invites | certified #246 + live re-proven #262 (INS 42501) | n-a | n-a | n-a | pol: platform admin all (creation/revocation via admin RPCs) |
| venue_geocode_cache | live: denied (no policies) | svc | svc | svc | svc |
| venue_geocode_rate | live: denied (no policies; slot via revoked RPC #261) | svc | svc | svc | svc |
| venues | live: denied | n-a | n-a | pol: member select; owner/admin manage | n-a |

**Phase 3 status:** original deployed-schema anon column live-complete (29/29), re-verified post-migrations (#271); table 30 (`portal_accounts`) is deployed and locally behavior-proven, with account-journey live proof pending (#273). Table 31 (`password_reset_requests`) is locally behavior/ACL-proven and pending migration 0022 production application (#274). Guest/couple account gates are locally complete; venue column is PARTIALLY LIVE-PROVEN via journey 8.1 (#272); remaining venue cells + platform column are policy-derived because the matrix sweep was skipped by operator choice. UPDATE/DELETE note: anon saw zero rows on the deployed schema, so row-targeted writes were inert; all write policies additionally derive from `auth.uid()`/roles.

## D. Phase 4 — console flow audit

| # | Console / flow | Hotspot files | Status |
|---|----------------|---------------|--------|
| 4.1 | Platform console: venue create → invite → reissue → suspend/reactivate | PlatformAdminPortal, AdminPanel | open |
| 4.2 | Platform console: metrics, branding, settings, chat | get_platform_console_metrics path | open |
| 4.3 | Venue onboarding/claim (end-to-end) | VenueAdminOnboarding | **complete live (#272); password-policy update local, rollout pending (#273)** |
| 4.4 | Venue dashboard | VenueDashboard (957) | open (pairs with 1.7) |
| 4.5 | Venue calendar | VenueCalendar (713) | open (pairs with 1.13) |
| 4.6 | Venue chat | VenueChatPanel (595) | open (pairs with 1.16) |
| 4.7 | Venue floor plan / layouts | FloorPlanCanvas (1890), layouts, layout_versions | **complete** | #267: deep flow pass — F-267-1 (P4) UndoRedoContext impure updaters fixed: nested setPast/setFuture/onRestore inside state updaters double-appended history under StrictMode (Ctrl+Z restored 2×/press, proven by behavioral test failing pre-fix); drag/pan/zoom state machine clean (conditional listeners, cursor-anchored zoom, clamped pan); one undo snapshot per drag + discrete nudge steps; coordinate math consistent; explicit-save model with dirty tracking + beforeunload guard + overwrite protection. Pinned by UndoRedoContext.strictmode.test.tsx (behavioral) |
| 4.8 | Venue admin panels (19 management screens) | admin/* | open (pairs with A.2–A.6, A.8–A.12, A.14–A.19, A.23–A.24) |
| 4.9 | Staff operations console: tasks/kanban, areas, shifts, BEO | StaffOperationsPanel (2061) | **complete** | #266: deep flow pass — F-266-1 (P4) import shape-validation fix (non-array tasks → garbage entries or TypeError crash on confirm), F-266-2/3 (P5) input reset + blob-URL revoke; CRUD gated+stamped, confirm dialogs live-array (no stale capture), shift conflicts warn-by-design, zero async surface, createObjectURL sweep 8/9 clean; VendorPanel (294 ln) triaged — effect-free, edit flow covered by VendorPanel.edit.test.tsx; timeline via useTimeline (triaged #263) |
| 4.10 | Couple portal: view, RSVP, layout editor/preview | CouplesPortal (3930), CoupleLayoutEditor/Preview | **complete** | #263/#265 flow audit complete. #273: personal account gate, isolated Auth surface, stable primary identity, safe reissue, and ten-RPC account authorization added and locally pinned; live rollout pending |
| 4.11 | Guest portal: view, submit RSVP | GuestPortal (2414) | **complete** | #263/#265 flow audit complete. #273: personal guest account gate, fixed invite email, isolated Auth, and account-bound snapshot/RSVP RPCs added and locally pinned; historical no-email compatibility retained; live rollout pending |
| 4.12 | Auth/session lifecycle: sign-in, restore, sign-out, role routing | AuthBackend, session persistence | **complete locally; production recovery verification pending** | #274: strict active surface entitlement on restore/sign-in; target-surface persistence cleared before network teardown; platform/venue sessions isolated; direct reset proof captured before provider bootstrap and URL-scrubbed; token-hash/PKCE/legacy proofs bounded; password update followed by global sign-out and correct branded login return; raw auth details suppressed; focused + full regressions pinned |
| 4.13 | Event-bus + store correctness (cross-console) | event bus, stores, hooks (20) | **complete** | #263: listener cleanup clean; hooks triaged; F-263-1 (P4) fixed. #264: 19 timer-cleanup sites swept (only real drop = F-264-1 (P4) debounced-save drop on unmount, FIXED+pinned); async pollers guarded (#245) except PlatformVenueChatPanel (P5 declined, self-healing); cross-tab store races none (storage-event refresh + server CAS). Closes 4.13 |
| 4.14 | Unhandled rejections sweep (cross-cutting) | async surfaces codebase-wide | **complete** | #268: F-268-1 (P4) fixed — portal 5s pollers (try/finally w/o catch) + debounced save + unmount flush + public branding RPC all leaked unhandled rejections while offline (withTimeout REJECTS on stall); pulls catch quietly (retry built-in), save emits typed spm_cloud_sync_error (App toast), branding resolves null. 4 clean surfaces verified. Protocol checklist: cleanup/hooks/races/hotspots/rejections ALL done |
| 4.15 | Optimistic-update rollback + state-machine completeness (protocol close) | async-mutating surfaces codebase-wide | **complete** | #269: F-269-1 (P3) fixed — guest RSVP cloud failure was false-success + silent swallow + 5s-poll wipe of the visible local copy; now emits typed spm_cloud_sync_error on both failure paths and the poll keeps the local RSVP when remote has none. All other surfaces verified pessimistic or local-first-with-error-events. PHASE 4 COMPLETE — every protocol item closed with evidence (#263–#269) |
| 4.16 | Deferred P5 backlog cleanup | PlatformVenueMap, LodgingBuilder, portal chat cadence, misc | **complete** | #270: PlatformVenueMap selected-marker radius frozen at map-build (stale closure; effect rightly excludes selectedId to avoid rebuild-per-click freeze) — FIXED via markersRef + setRadius sync effect, pinned 4 tests. 4 remaining P5s formally declined with reasons (LodgingBuilder bounded drag, msgTick cadence, shift-time '' cosmetic, clipboard fallbacks). Phase 4 FULLY complete incl. backlog |

## E. Edge Functions (5)

| # | Function | Status | Notes |
|---|----------|--------|-------|
| 5.1 | claim-venue-admin | done; #273 deployment workflow passed | #247/#248; #273 shared server password policy + bounded token/name/password inputs |
| 5.2 | geocode-venue | open | bearer-auth confirmed #246; validate inputs, rate limits, Geoapify error paths |
| 5.3 | send-email | open | bearer-auth confirmed #246; abuse limits (spam via authenticated callers?) |
| 5.4 | claim-portal-invite | done; #273 deployment workflow passed, live journey pending | #273: token-context validation, shared password policy before Auth creation, existing-user no-reset path, transactional bind/orphan cleanup/bounds; F-273-9 fixed the initial workflow omission and added a deployment contract test |
| 5.5 | request-password-reset | deployed; production configuration + inbox proof pending | #274: public neutral-response door; service-derived eligibility; hash-only atomic throttling; server-owned branded origin/sender; background delivery with provider deadlines/failover; fragment proof; explicit no-JWT deployment step. Live follow-up found the production origin unset and the password-specific URL name duplicated existing project configuration; the function now uses one project-wide origin for all tenants with environment overrides and the old name as a compatibility fallback. A workflow sync attempt correctly failed because the least-privilege deploy token cannot administer secrets; the public production origin/sender are therefore versioned as server-side deployment defaults instead of broadening token privileges. |

## F. Cross-cutting sweeps

| # | Sweep | Status |
|---|-------|--------|
| 6.1 | Event-bus / subscription listener leaks (mount-unmount cycles) | open |
| 6.2 | Unhandled promise rejections + async error swallowing | open |
| 6.3 | Conditional-hooks correctness (7 files flagged #245) | open |
| 6.4 | Race conditions in client stores (optimistic updates, cache invalidation) | open |
| 6.5 | Loading/error/empty-state completeness per screen | open (pairs with D) |
| 6.6 | Oversized/adversarial input handling on every externally-reachable field | open |
| 6.7 | Secrets & env hygiene sweep (no keys client-side; Edge env expectations documented) | **complete for auth/recovery #274** — client receives only publishable config; service/mail secrets remain Edge-only; tracked-file + credential-pattern scans passed; production sender/origin fail closed |
| 6.8 | Dead code / superseded paths (e.g. create_venue_organization_v); + shared-component private duplicates in ~13 admin panels vs 8 shared importers (#249 F-249-2) | open |

## G. Drift & config

| # | Check | Status |
|---|-------|--------|
| 7.1 | Live schema fingerprint vs migrations 0001–0022 | open (0018–0020 applied/live-verified #271; 0021 operator-confirmed applied #273; 0022 pending operator application #274; full re-fingerprint pending) |
| 7.2 | Storage: MIME allowlist + per-bucket policies | certified #247 (public-branding); other buckets open |
| 7.3 | Grants fingerprint (function execute grants vs intended callers) | open live; 0021 internal ACLs behavior-proven locally #273; 0022 table/functions service-only ACLs PGlite-proven #274 |
| 7.4 | Edge Function env vars + CORS posture (known #245 note) | open overall; claim Functions contract-checked #273; #274 recovery endpoint enforces branded production origin/sender, bounded CORS/input, provider deadlines/failover, and documents required Edge-only secrets |

## H. E2E journeys (browser-level, after Phase 5 harness)

| # | Journey | Status |
|---|---------|--------|
| 8.1 | Platform → create venue → invite → claim → first sign-in | **complete (live E2E)** | #272: operator-provided invite → context RPC → claim-venue-admin Edge Function (0017 atomic: ownership + membership + invite consumption + platform audit in one tx) → password sign-in → replay attempt correctly rejected. Venue-column cells live-proven: organizations (member scoping + owner_id transfer), organization_memberships, org_data member reads, audit_logs org-admin reads (0020 legit path); platform_* negative cells all 0 rows |
| 8.2 | Claim → configure → couple portal publish → guest RSVP → venue sees submission | open; personal account implementation deployed and locally complete #273; fresh live artifacts needed |
| 8.3 | Reissue invite → stable personal account → old token denied/current session evaluated | deployed contract complete #273; live journey pending |
| 8.4 | Suspend venue → each console's behavior | open |
| 8.5 | Concurrent RSVP race (two guests, one couple) | harness ready, run deferred #248 |
| 8.6 | Guest token expiry / access window edges | open |

---

## Artifact request board (live-throwaway mode — batched, not per-unit)

*Provision when convenient; I'll pick these up and keep sessions/cleanable state for them.*

| Artifact | Needed by | Status |
|----------|-----------|--------|
| Reset the #272 venue-owner account password | F-273-0 credential containment | **complete 2026-09-02** — operator confirmed reset; current tree redacted, consumed invite token and historical password are inert; history rewrite not attempted |
| 1 pending venue-admin invite → throwaway email (setup-link token pasted here) | Phase 3 venue column + journey 8.1 | **provided + consumed (#272)** — invite pointed at operator's own email (deviation logged); password exposure contained in #273 |
| 2 **email-backed, personal-account-marked** guest-portal invitations for the same throwaway couple + its couple id | journeys 8.2/8.5 + migration 0021 live proof | requested |
| 1 fresh email-backed couple/collaborator invitation to a throwaway email | personal-account claim/reissue live proof (#273 / journeys 8.2–8.3) | requested after 0021 + both claim Functions deploy |
| Live app URL + publishable/anon key (never service-role), supplied only for the verification session | post-0022 recovery + account probes | requested after migration/function/frontend deployment confirmation |
| 1 throwaway inbox with an active venue-admin account + venue slug (and permission to reset only that password) | #274 live request → inbox → save → post-reset sign-in proof | requested after recovery sender/provider configuration |
| 1 second invite → second throwaway email (cross-user negative tests) | Phase 3 (negative cells) | later |
| 1 throwaway venue you are willing to have suspended | 8.4 suspension paths | later |
| 3.1 throwaway auth accounts for sign-in probes: (a) claim the row-1 invite with a throwaway sign-up (covers venue column + journey 8.1), (b) one plain fresh sign-up (negative cells + signup bootstrap flow), (c) platform_memberships row for account (a) or a third account — SQL script provided in #262 (covers platform column) | Phase 3 venue/platform columns live proof | requested (#262) |

**Session state:** no credential files or authenticated browser sessions retained. #272 consumed one venue-admin invite and changed that existing account password as logged there; no #273 or #274 live mutation has occurred.
