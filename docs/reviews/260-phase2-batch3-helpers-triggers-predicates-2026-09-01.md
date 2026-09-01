# Review #260 — Phase 2 Batch 3: internal helpers, triggers & predicates (units 2.16–2.25, 2.32–2.37, 2.42)

**Date:** 2026-09-01 · **Mode:** continuous campaign · **Report-only batch — no code changes required.** All seventeen functions pass the checklist.

**Live anon probes:** `is_platform_admin` → `false`, `is_org_member` → `false`, `has_org_role` → `false`, `org_data_write_allowed` → `false`, `org_data_array_len([1,2,3])` → `3`, `sync_couple_projection` → `{"ok":false,"error":"forbidden"}`. Exactly the expected behavior — no data leakage, gates hold.

## Two architectural facts that settle the grant-hygiene checklist for this cluster

1. **Trigger functions are not RPC-invocable.** `set_updated_at`, `set_org_data_updated_at`, `set_couple_snapshot_updated_at`, `set_platform_chat_sender_side`, `prevent_organization_slug_change`, and `handle_new_user` all `return trigger` — PostgREST cannot call trigger-returning functions, so their default PUBLIC execute grant is inert. No revokes needed (revoking would be cosmetic only).
2. **RLS predicates must keep their grants.** `is_org_member`, `has_org_role`, `is_event_member`, `has_platform_role`, `is_platform_admin`, `is_platform_support`, `org_data_write_allowed` are used inside `create policy … using (…)`. Policies evaluate as the *querying* role, so anon/authenticated must retain EXECUTE or RLS itself breaks. They are correctly `security definer` (avoids recursive policies) and `stable`, and every one derives identity from `auth.uid()` — calling them as anon just returns false. Grant state is correct by construction, not an oversight.

## Unit verdicts

- **2.16 `handle_new_user` (0001:529)** — CLEAN. Trigger on `auth.users`; idempotent profile insert (`on conflict do nothing`).
- **2.17 `has_org_role` / 2.20 `is_org_member` (0008:41/59)** — CLEAN. Security-definer membership lookups keyed on `auth.uid()`, status-filtered.
- **2.18 `has_platform_role` (0006:42)** — CLEAN. Same pattern against `platform_memberships`.
- **2.19 `is_event_member` (0001:337)** — CLEAN. Org-member OR active event-membership.
- **2.21 `is_platform_admin` / 2.22 `is_platform_support` (0006:60/72)** — CLEAN. Role-array wrappers.
- **2.23 `org_data_array_len` (0011:34)** — CLEAN. Pure immutable computation on caller-supplied jsonb; zero table access, zero leak.
- **2.24 `org_data_write_allowed` (0010:233)** — CLEAN. The #180 remediation's admin-domain allowlist (`config`/RBAC/security/invites/templates/operations) OR `has_org_role(owner, admin)` — wired into all three org_data write policies.
- **2.25 `prevent_organization_slug_change` (0008:21)** — CLEAN. Raises `organization_slug_immutable` on slug change; backs the update RPC's immutability claim.
- **2.32 `set_couple_snapshot_updated_at` (0005:41), 2.33 `set_org_data_updated_at` (0003:35), 2.35 `set_updated_at` (0001:281)** — CLEAN. `new.updated_at = now()` triggers.
- **2.34 `set_platform_chat_sender_side` (0010:274)** — CLEAN. Derives `sender_side` server-side (platform admin → 'platform', org member → 'venue') and **raises** for anyone else — the #180 N-6 remediation; client-supplied values are overwritten, never trusted.
- **2.36 `snapshot_guest_token_expires_at` / 2.37 `snapshot_token_expires_at` (0007:116/70)** — CLEAN. Pure expiry derivation from caller-supplied payloads (collaborator-specific, event fallback +2 days in `America/New_York`); both are the enforcement helpers the guest/couple RPCs call.
- **2.42 `sync_couple_projection` (0011:56)** — CLEAN. Org-role gate (owner/admin/planner/staff); jsonb shape coercion; slug uniqueness vs non-projected events; all writes are `on conflict` upserts keyed on source ids (idempotent); portal tokens stored only as sha256 hashes; titles capped at 200. **Declined (P4):** the three array payloads are unbounded — but the caller is an authenticated venue member mirroring data that lands in `org_data` under the same roles anyway; the storage exposure is identical, so a cap here adds no protection.

## Gates

No source changes (docs only) — standing gate state from #258/#259 applies.

## Registry delta

Rows 2.16–2.25, 2.32–2.37, 2.42 → `done`. Phase 2: **35/46**. Remaining: 2.6 `geocode_try_acquire_slot`, 2.12 `get_platform_console_metrics`, 2.13 `get_public_platform_branding`, 2.14 `get_public_venue_branding`, 2.15 `get_venue_admin_invite_context` (residual), 2.44 `upsert_couple_portal_snapshot`, 2.45 `upsert_platform_branding`, plus the residual re-audits 2.2, 2.3, 2.27, 2.46.
