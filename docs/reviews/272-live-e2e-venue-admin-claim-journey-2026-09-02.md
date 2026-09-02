# Review #272 — Live E2E: Venue-Admin Invite Claim Journey (8.1) + Venue-Column Cells

**Date:** 2026-09-02 · **Mode:** live journey against the production project (operator-provided invite link) · **Baseline:** `5f2ed80` (#271, CI green)

## Method

The operator pasted the board's pending venue-admin invite link (`/i/va-95a92153…`, reissued 2026-09-02 19:00 UTC for this session). The journey was run exactly as the app runs it: context RPC → `claim-venue-admin` Edge Function → password sign-in → authenticated verification probes. Per the user's direction, the throwaway-account RLS-matrix sweep (request 3.1a/b/c) was **skipped** — only the journey and its incidentally-covered cells were proven live.

## Journey 8.1 — every step live-proven

| # | Step | Live result |
|---|---|---|
| 1 | `get_venue_admin_invite_context(p_token)` — invite landing | `ok:true` — Seven Paths Manor (`seven-paths-manor`), role **owner**, invited email, expiry 2026-09-09. Minimal pre-auth context only (matches #261's 2.15 audit). |
| 2 | `claim-venue-admin` Edge Function (token + throwaway password + probe name) | `ok:true, claimed:true, existingUser:true` — the **0017 atomic claim** ran server-side in one transaction. |
| 3 | Password sign-in (`grant_type=password`) | Session issued; user `c80d5572-d893-44f9-ac8d-034d80432f66`, email confirmed. |
| 4 | Ownership transfer | `organizations` → exactly 1 row visible: Seven Paths Manor, **`owner_id` = claiming user** (RLS member scoping: no other org leaks). |
| 5 | Membership | `organization_memberships` → 1 row: owner/active. |
| 6 | Invite consumed | context lookup with the same token now → `not_found`. |
| 7 | **Replay protection** | second Edge Function claim with the same token → `400 not_found` (atomic consumption holds; cannot re-reset the password). |
| 8 | Audit trail | `platform_audit_logs` row `venue_admin_invite.claimed` written service-side (0017 §insert); correctly invisible to the venue account (platform_support-only reads). |

## Venue-column cells proven live (upgraded from policy-derived)

- `organizations` member SELECT + owner write-path outcome (owner_id = claimant) — **live**
- `organization_memberships` member SELECT (own row) — **live**
- `org_data` member SELECT (org-scoped domain payloads, e.g. `wallStyles`) — **live**
- `events` member SELECT (0 rows — no events; readable, no cross-org leak) — **live**
- `audit_logs` org-admin SELECT of org-scoped rows (5 visible; invite-sent history) — **live**, and it exercises the **0020 policy's legitimate path**: org admins still read their org's audit rows after the null-org free pass was closed
- Negative cells: `platform_memberships`, `platform_audit_logs`, `platform_settings`, `org_invites` → **0 rows** for the venue account — **live**

Remaining venue-column cells (role-tiered writes, org-invite member insert, reissue/revoke RPCs) stay **policy-derived** (#262 inventory) — the matrix sweep was skipped by user choice.

## Live mutation log (this session)

1. Venue-admin invite `va-95a92153…` (Seven Paths Manor, owner) **consumed** via the atomic claim — this was the board's intended action. The full token is intentionally redacted.
2. Password on the invited account `[operator email redacted]` (existing user) **reset** to a throwaway probe password (**redacted**). Review #273 records the accidental Git-history exposure and the operator's 2026-09-02 confirmation that the password was reset again, making the historical value inert.
3. Organization ownership + membership ensured for user `c80d5572-d893-44f9-ac8d-034d80432f66` (service-side, transactional).
4. `platform_audit_logs` row `venue_admin_invite.claimed` written (service-side).

Deviation note: the board requested a throwaway email; the pending invite pointed at the operator's personal address. The operator was warned ("the claim sets a new password on whichever email the invite points at") before pasting the link and proceeded.

## Gates

Docs-only commit (no code change): CI full chain re-run on push.

## Disposition

**Registry 8.1 (live claim E2E) → COMPLETE.** Artifact board row "1 pending venue-admin invite" → provided + consumed. Phase 3: anon column live-verified post-migrations (#271); venue column now partially live-proven (this review) with the rest policy-derived; platform column stays policy-derived (request 3.1c grant not exercised — user's choice). Remaining live work: RSVP/claim guest journeys (8.2–8.6) if throwaway portal artifacts are ever provisioned.
