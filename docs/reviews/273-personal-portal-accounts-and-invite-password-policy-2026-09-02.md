# Review #273 — Personal Invitee Accounts + Enforced Invite Password Policy

**Date:** 2026-09-02 · **Mode:** feature implementation, adversarial review, and local verification · **Baseline:** `5bbc774` (#272, CI green) · **Live status:** migration/Functions/frontend not yet deployed

## Findings — reported before remediation

This review stayed inside the requested invitation/account boundary. It did not turn the work into a broad repository remediation pass.

| ID | Severity | New finding | Security/user impact |
|---|---|---|---|
| F-273-0 | **P0** | Final credential scanning found that review #272 had committed the exact throwaway password used on the operator's existing venue-owner account, along with the full consumed invitation token and real email. | The token is consumed, but the password may remain a live production credential and is recoverable from pushed Git history. Immediate password reset is required. |
| F-273-1 | **P1** | Gating only the four base snapshot RPCs left six alternate public token surfaces: four venue-scoped overloads plus relational `get_guest_by_portal_token` and `submit_guest_rsvp`. | A newly account-required invite could still be used as a bearer token through an alternate endpoint, defeating the requested backend account boundary. |
| F-273-2 | **P1** | Invite context was initially resolved before the participant lock and reused during claim. A concurrent token rotation, deletion, or email/identity edit could supersede that context while the claim was waiting. | A stale invitation could be bound after its authority changed. This is a claim-time TOCTOU defect. |
| F-273-3 | **P1** | Couple and guest routes were classified as venue-auth surfaces and shared venue Auth storage/context. | A retained staff session could leak staff identity/organization into a public portal, while a portal sign-in could overwrite or sign out the venue session. |
| F-273-4 | **P1** | The primary couple was inferred from a mutable `role === 'couple'` list, and primary-token rotation updated every couple-role collaborator. | Co-owner identities could collapse onto the primary token during reissue; this is unsafe once each invitee owns a distinct account. |
| F-273-5 | P2 | A failed remote portal sign-out could leave the local portal JWT and PKCE verifier in storage. | “Sign out” could appear to finish while the browser remained locally authenticated. |
| F-273-6 | P2 | The undeployed-RPC compatibility check matched broad error text. Network/timeout failures mentioning the RPC path could be mistaken for “function absent.” | A transient backend failure could silently downgrade an account-required portal to the historical bearer-link path. |
| F-273-7 | P2 | Newly issued/reissued invite tokens were not uniformly tied to a normalized, valid invitee email, and a claimed guest email could be edited in place. | Personal-account identity could be ambiguous or reissue could produce an invitation no account could safely claim. |
| F-273-8 | P3 | `nanoid@3.3.17` was reported by `npm audit` as a high-severity dev-tool transitive dependency. | Build/test dependency exposure only; no runtime bundle impact. |

## Remediation

### 0. Credential containment

The exact password, full consumed token, and real invitee email were removed from the current documentation/memory; copied live addresses in the touched invite test fixtures were replaced with reserved `example.com` data. The invite token had already been consumed and replay-tested, so it has no remaining authority.

Redaction does **not** erase pushed commit `5bbc774`. The operator confirmed on 2026-09-02 that the affected account password was reset, so the historical value is now inert. A shared-history rewrite would be disruptive and is not attempted without explicit operator approval. Future live logs must record secret identifiers only as redacted prefixes and must never record passwords.

### 1. One canonical password contract

Browser and Edge implementations now enforce the same invitation-password rules:

- 8–128 characters;
- at least one ASCII uppercase letter;
- at least one ASCII lowercase letter;
- at least one digit;
- at least one non-whitespace special character.

The venue-admin setup and the couple/collaborator/guest account setup all use the reusable `InvitePasswordFields` component. It provides:

- a visible live requirements list;
- live “Passwords match / do not match” status;
- submit blocking until the create-password form is valid;
- independent show/hide controls for both fields;
- explicit labels, `aria-pressed`, `aria-invalid`, `aria-describedby`, and polite live status;
- `new-password`/`current-password` autocomplete semantics.

`claim-venue-admin` and `claim-portal-invite` call the shared Edge policy before account creation. Browser checks are only early feedback, not the security boundary. Full name, token, couple ID, venue slug, and password inputs are bounded on their applicable client/server paths.

### 2. True personal accounts for portal invitees

Migration `0021_portal_invitee_accounts.sql` introduces `portal_accounts`, mapping one active Supabase Auth user to:

`organization + couple + participant type + stable participant ID`.

Passwords remain solely in Supabase Auth. They are never stored in snapshots, local storage, or `portal_accounts`.

The new flow is:

1. Resolve only minimal invite context with `get_portal_invite_context`.
2. For a new Auth email, `claim-portal-invite` creates a confirmed Auth user, then calls the transactional claim RPC.
3. For an existing Auth email/account, the invitee signs in with their existing password and accepts through the authenticated RPC; invitation possession never resets an existing password.
4. The transaction binds the JWT/Auth user to the exact current participant.
5. Portal read/write RPCs require that account mapping whenever the snapshot marks the participant `personalAccountRequired`.

Couple and guest routes use independent Supabase clients and independent Auth storage keys. Venue/platform sessions remain retained internally, but `AuthContext` exposes no staff user, organization, or platform role while a portal surface is active.

### 3. Authorization closure and race safety

Migration 0021 gates all **ten** public token entry points:

- four base couple/guest snapshot read/write RPCs;
- four venue-scoped overloads;
- relational guest lookup and RSVP submission.

The six renamed token implementations are internal-only: `PUBLIC`, `anon`, and `authenticated` execute privileges are revoked. The PGlite behavior harness proved that `anon` cannot execute those implementations directly.

Claim uses a participant-scoped PostgreSQL advisory transaction lock, including when no mapping row exists yet. After acquiring it, the transaction re-resolves invitation context and rejects a superseded token, participant, email, expiry, or account state. An orphan Auth user created during a failed first-time claim is cleaned up by the Edge Function.

### 4. Stable identity, reissue, and compatibility

- The primary couple has the stable participant ID `primary-couple`; new local records also materialize a stable owner collaborator.
- Primary reissue rotates only that owner’s token, not every collaborator whose role is `couple`.
- New primary, collaborator, and guest tokens require a normalized valid email.
- Once a personal guest invitation has an email, generic edits cannot silently transfer that identity to another address.
- Existing account mappings survive token rotation, so preserved event/layout/guest/RSVP/team data remains attached to the same principal.
- `portal_accounts` cascades only when its underlying couple snapshot is deleted, preventing orphan mappings without coupling account lifetime to token lifetime.
- A trigger refreshes couple/collaborator token hashes on every snapshot payload write and backfills existing snapshots.
- Truly historical records with no `personalAccountRequired` marker and no valid email retain bearer-link compatibility. New/reissued invitations carry the marker and cannot downgrade through a public RPC.

### 5. Failure-path hardening

- Portal logout removes only the selected portal session and verifier in `finally`, even if remote sign-out fails.
- Organization context is cleared only for a cloud-account portal logout; historical local/preview exits do not erase unrelated venue context.
- Legacy fallback occurs only for a precise PostgREST “function not found / schema cache” response. Timeout and network failures remain failures.
- Admin-composed invitation mail is blocked when the target email is invalid.
- `nanoid` was lockfile-updated to 3.3.18; `npm audit` now reports zero vulnerabilities.

## Preservation proof

The migration adds account mappings and authorization wrappers; it does not rewrite wedding content. The hash backfill assigns each snapshot payload to itself solely to invoke the hash-refresh trigger. The PGlite harness loaded migrations through 0021 and verified:

- migration execution;
- legacy no-email compatibility;
- account-required authorization behavior;
- stale/superseded token rejection;
- direct internal-function ACL denial;
- account mapping persistence across reissue behavior;
- mapping cascade when the underlying couple snapshot is deleted.

No live project data was mutated during this review.

## Verification gates

| Gate | Result |
|---|---|
| Focused affected tests | **7 files / 52 tests passed** |
| Full Vitest | **272 files passed, 4 skipped; 1111 tests passed, 5 skipped** |
| TypeScript | `npm run typecheck` passed |
| Strict production unused-locals audit | passed (`NO_UNUSED_PRODUCTION_ERRORS`) |
| ESLint | passed with **0 errors / 27 pre-existing warnings** |
| Typed event-bus lint | passed |
| `@ts-nocheck` ratchet | **0 / ceiling 0** |
| Edge typecheck | both Functions passed `npx deno check`; generated `deno.lock` removed |
| Migration/authorization behavior | PGlite harness passed: `MIGRATION_OK`, `AUTHORIZATION_BEHAVIOR_OK` |
| Dependency audit | **0 total vulnerabilities** |
| Single-file build/budget | passed — 2230.89 KiB raw / 536.81 KiB gzip |
| Split build/budget | passed — largest chunk 681.24 KiB raw / 148.96 KiB gzip |
| Whitespace/secret review | `git diff --check` passed; final current-tree scan found no #272 password/full token/real invite email; only documented placeholders remain |

Full Vitest retained known non-failing jsdom/React warnings (canvas/navigation, selected `act(...)` notices, and intentional corrupt-storage probes). The split build retained known code-splitting/chunk-size warnings; the enforced bundle budget passed.

## Rollout contract

This change is **locally complete but not live-complete**. Deploy in compatibility-safe order:

1. Operator applies migration **0021** through the approved Supabase migration/SQL workflow.
2. Deploy `claim-portal-invite` and the updated `claim-venue-admin` with `verify_jwt = false` from `supabase/config.toml`.
3. Deploy the frontend only after both backend layers are available.
4. Live-probe denials and invite context, then run fresh email-backed couple and guest claims using operator-provisioned throwaway invitations.

Do not create/reissue invitations or claim accounts against live non-throwaway participants during verification.

## Disposition

F-273-0 is contained: the current tree is redacted and the operator confirmed the exposed password was reset. All feature-scope P1/P2 findings are remediated and pinned locally. Acceptance criteria are implemented: venue, couple/collaborator, and wedding-guest invitees receive personal passwords with accessible live validation; the same policy is server-enforced; backend reads/writes are account-bound for new invitations; historical compatibility and safe reissue/data preservation are retained.

**Remaining:** push + CI; operator-run migration/Edge/frontend rollout; then live throwaway verification before this feature is certified live.
