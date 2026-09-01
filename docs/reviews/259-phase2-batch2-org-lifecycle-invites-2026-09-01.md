# Review #259 — Phase 2 Batch 2: org lifecycle + invite management RPCs (units 2.1, 2.4, 2.5, 2.26, 2.28, 2.29, 2.41, 2.43)

**Date:** 2026-09-01 · **Mode:** continuous campaign · **Report-only batch — no code changes required.** All eight functions pass the per-unit checklist with only P5 notes (recorded as declined below).

**Live verification (read-safe anon probes, bogus ids/tokens):** every function's internal gate fired *before any write* — `suspend/reactivate/revoke/reissue/update/create/create_v2` → `{"ok":false,"error":"forbidden"}`, `accept_invite` → `{"ok":false,"error":"auth_required"}`. Grant state matches repo expectations: these are authenticated-callable with the real control inside the function body, consistent with the platform-console pattern.

## Unit verdicts

- **2.1 `accept_invite` (0006:401)** — CLEAN. Token-hash lookup + `status='pending'` + expiry; **authz derivation is exemplary**: requires `auth.uid()` AND the JWT email to match the invited email (token possession alone is not enough). The lockless read of the invite is a benign race — the membership upsert (`on conflict do update`) and the status update both converge; re-accepting after `accepted` returns `not_found`. Audit-log declined: the invite status flip + membership row are the record; nothing administrative happens.
- **2.4 `create_venue_organization` (0008:89)** — CLEAN, **superseded**: the client calls v2 only; v1 remains coherent, admin-gated, audited, and handles `unique_violation` gracefully (`venue_slug_exists`). Keeping it (no revoke): it is authenticated+admin-gated, i.e. harmless, and dropping would be a live DB change for zero risk reduction.
- **2.5 `create_venue_organization_v2` (0014:6)** — CLEAN. Full field validation (name/address/city/state/postal/contact/phone, dual email regex, token ≥16), immutable generated slug with collision suffixing, audit row, geocode tagging. Note: `p_expires_at`/`p_latitude`/`p_longitude` are required with no defaults, so partial PostgREST calls 202 — expected, the single client caller passes all params.
- **2.26 `reactivate_venue_organization` (0008:456)** — CLEAN. Owner-aware status derivation (`provisioning` vs `active`), clears suspension fields, audited.
- **2.28 `reissue_venue_admin_invite` (0015:75)** — CLEAN. Org must be provisioning/active; email/token validated; revokes pending invites before inserting the new one; audited with metadata.
- **2.29 `revoke_venue_admin_invite` (0008:309)** — CLEAN. Single atomic `UPDATE … WHERE status='pending' RETURNING` — no TOCTOU; audited with reason.
- **2.41 `suspend_venue_organization` (0008:419)** — CLEAN. Atomic update + found-check, cascades invite revocation, audited.
- **2.43 `update_venue_organization` (0014:90)** — CLEAN. The most thorough validator in the cluster (14 fields), immutable slug (backed by the `prevent_organization_slug_change` trigger), suspension-aware timestamp handling, status-change side effects, audit row with previous status.

## Declined (P5, written reasons)

- **suspend double-invoke overwrites audit fields:** re-suspending an already-suspended org rewrites `suspended_at`/`suspended_by` to the latest invocation (v1 `update_venue_organization` correctly uses `coalesce`). Admin-only, requires a deliberate second suspend, and each action still gets its own audit row — not worth a live migration on its own. Fold into the next migration that touches this file.
- **create_v2 slug race returns a raw 500:** v2 lacks v1's `unique_violation` handler, so the (already rare) concurrent same-name slug race surfaces as an unhandled error instead of `venue_slug_exists`. Same disposition: fold into the next migration.
- **Unbounded `p_name` length on the create/update functions:** admin-only input; the column is `text`. Low priority.
- **Concurrent reissues can leave two pending invites:** both revocations are idempotent and both inserts succeed; the 0017 atomic claim ensures only one can ever be claimed (first claim wins, second fails as already-claimed). Benign.
- **`update_venue_organization` reads previous state without a lock:** two concurrent admin updates are last-writer-wins on the row, both audited. Acceptable for a single-admin console surface.

## Gates

No source changes in this batch (docs only) — the standing gate state from #258 applies: tsc + strict scan clean · vitest 1035 pass / 5 skip · lint 0 err / 30 warn · single 546.51 kB gzip · audit 0.

## Registry delta

Rows 2.1, 2.4, 2.5, 2.26, 2.28, 2.29, 2.41, 2.43 → `done`. Phase 2: **18/46**. Next batch: internal helpers/triggers (2.16–2.25, 2.32–2.37, 2.42) incl. the grant-hygiene sweep for PUBLIC-default execute on non-client functions, then the platform console/branding/metrics remainder (2.6, 2.12, 2.13, 2.14, 2.15 residual, 2.44, 2.45, 2.2/2.3/2.46 residuals).
