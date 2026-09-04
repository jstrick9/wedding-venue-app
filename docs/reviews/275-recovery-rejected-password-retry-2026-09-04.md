# Review #275 — Recovery Retry After Rejected Password

**Date:** 2026-09-04 · **Mode:** live-defect follow-up, adversarial auth/session review, and local verification · **Baseline:** `7264cde` (#274 released) · **Live status:** correction not yet deployed; one fresh reset-link retest required after deployment

## Findings — reported before remediation

This review stayed inside the platform/venue authentication and password-recovery boundary. No live data was mutated.

| ID | Severity | New finding | Security/user impact |
|---|---|---|---|
| F-275-1 | **P1** | After a one-time recovery proof was exchanged, any password-update rejection triggered local cleanup. A second submit then tried to exchange the already-consumed proof again. | A venue administrator who selected the current or otherwise disallowed password lost the verified recovery session and could not choose another password from the same reset screen, breaking standard self-service recovery. |
| F-275-2 | P2 | Current-password and password-history rejection details were collapsed into generic failure handling; text containing “already used” could even be classified as an already-used reset link. | The user did not receive an actionable, white-label reason and could be told to request another link when only the password candidate needed to change. |
| F-275-3 | P2 | A naïve “retain the session on error” correction would leave concurrency and abandonment races: simultaneous submissions could race proof exchange, and navigation during an in-flight successful save could clear the token before global revocation. | Retry authority could become inconsistent, and successful recovery could skip the intended all-session revocation in a narrow navigation race. |
| F-275-4 | P2 | Moving every exchange to a new memory-only client would break legacy PKCE links because the verifier belongs to the original surface client’s storage. | Previously issued PKCE recovery callbacks could fail even though current token-hash links worked. |

## Remediation

### 1. Proof-bound, memory-only retry capability

A dedicated recovery client is cached separately for each auth surface with:

- `persistSession: false`;
- `autoRefreshToken: false`;
- URL session detection disabled;
- a recovery-specific network deadline;
- no use as a normal platform or venue application session.

The first valid token-hash, PKCE, or legacy implicit proof establishes a recovery-only session. Active authorization records the exact proof identity, surface, recovered user ID, recovery client identity, and bounded revocation token in module memory. A retry is accepted only when all of those identities still agree. An unrelated normal session can never authorize a password update.

Password policy is checked before a new proof is consumed. Once a proof is verified, these candidate/update failures retain the capability on the same screen:

- current password submitted again;
- password-history rejection;
- other password-policy rejection;
- temporary network or recovery-service failure.

The next compliant candidate reuses the verified recovery session and does not exchange the one-time proof again. Invalid, expired, mismatched, or otherwise fatal state is detached and locally revoked. Successful password update detaches the capability and performs bounded global revocation before returning to the branded sign-in door.

### 2. White-label actionable errors

Recovery error classification now recognizes both stable auth error codes and bounded message patterns. Customer-visible copy is:

- current password: “Your new password must be different from your current password. Choose another strong password and try again.”
- password history: “That password was used before. Choose a password you have not used for this account and try again.”

Unknown infrastructure details remain suppressed. The neutral forgot-password response and account-enumeration boundary are unchanged.

### 3. Concurrency, abandonment, and timeout safety

Same-surface password-save operations are serialized. A duplicate click therefore cannot race proof exchange or issue concurrent password updates.

The reset screen explicitly abandons recovery state on navigation and unmount. An abandonment generation prevents queued or proof-exchange work from reattaching a capability after the screen has gone away. An in-flight client is detached immediately but retains ownership of final cleanup: if its password update succeeds, it still uses the captured token for global revocation; otherwise it is locally revoked. Idle retained sessions are revoked immediately on abandonment.

Recovery network calls use a seven-second per-request ceiling so sequential proof exchange, password save, and bounded revocation finish below the screen’s 22-second user-facing timeout. Cleanup makes one bounded revocation request and does not invoke SDK sign-out a second time against the already-detached memory client.

### 4. Legacy callback preservation

A PKCE code is exchanged with the original platform/venue surface client so its verifier remains available. The returned durable surface state is synchronously cleared before the access and refresh tokens are transferred to the dedicated memory-only recovery client. User identity must match across exchange and transfer. Current production token-hash links never enter persistent recovery storage.

Platform and venue normal-session storage remain separate; recovery cleanup touches only the target surface. Successful recovery still globally revokes the recovered user’s sessions, while ordinary logout remains surface-local.

## Regression coverage

The correction is pinned by behavioral tests for:

- token-hash success and global cleanup ordering;
- rejection → retained session → weak-candidate rejection → different password success;
- password-history rejection → same-screen retry;
- proof exchange occurring exactly once across retry;
- unrelated normal sessions and incomplete implicit proofs being rejected;
- same-surface concurrent submissions being serialized;
- navigation during an in-flight successful save preserving global revocation;
- idle abandonment discarding retry authority and forcing a fresh proof exchange;
- memory-only per-surface client options, cache identity, and detachment;
- legacy PKCE exchange on the verifier-owning surface followed by memory transfer;
- UI remaining enabled after rejection and accepting a second candidate;
- current-password/history copy and raw infrastructure-detail suppression.

## Verification gates

| Gate | Result |
|---|---|
| Focused recovery/auth tests | **6 files / 30 tests passed** |
| Full Vitest | **283 files passed, 4 skipped; 1,152 tests passed, 5 skipped** |
| TypeScript | `npm run typecheck` passed |
| Strict production unused-locals audit | passed |
| ESLint | passed with **0 errors / 27 pre-existing warnings** |
| Typed event-bus lint | passed |
| `@ts-nocheck` ratchet | **0 / ceiling 0** |
| Dependency audit | `npm audit --omit=dev`: **0 vulnerabilities** |
| Single-file build/budget | passed — 2,254.92 KiB raw / 543.72 KiB gzip |
| Split build/budget | passed — largest chunk 680.79 KiB raw / 148.73 KiB gzip |
| Whitespace / credential / white-label checks | `git diff --check` passed; token-shaped tracked scan and non-test diff assignment scan clean; rendered recovery-copy regressions passed |

Full Vitest retained known non-failing React `act(...)` notices and intentional legacy-auth warnings. ESLint and split-build warnings are the pre-existing warning baseline; all enforced gates passed.

## Live mutation log

None. This review used source inspection, mocks, local unit/integration tests, static checks, and production builds only. No account, password, venue, membership, recovery request, email, or database row was changed live.

## Rollout and remaining proof

This change modifies frontend/auth client code and documentation only; it adds no migration or Edge Function change.

1. Commit and push the correction.
2. Verify GitHub CI and the frontend deployment at the exact pushed SHA.
3. Request one fresh branded venue reset email for the approved throwaway venue-admin account.
4. On that one reset screen, submit the account’s current or otherwise prohibited password and confirm the actionable rejection.
5. Without reopening the link or requesting another email, submit a different compliant password and confirm success.
6. Confirm return to the venue’s branded sign-in page; sign in with the new password; confirm the prior password fails.

The consumed pre-fix link cannot be repaired and is not valid test evidence. Live completion requires the fresh-link reject → retry → save → post-reset-login sequence above.

## Disposition

All new P1/P2 findings in this recovery boundary are remediated and pinned locally. The correction preserves neutral delivery, tenant/surface isolation, legacy callback compatibility, data and memberships, white-label copy, and post-success global revocation. It is **local-complete but not live-complete** until the pushed build is deployed and the fresh-link sequence passes.
