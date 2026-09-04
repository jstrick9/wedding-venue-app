# Review #276 — Personal-Portal E2E Readiness + Access Lifecycle

**Date:** 2026-09-04 · **Mode:** continuous risk-density review, safe live-harness preparation, and local lifecycle verification · **Baseline:** `5162642` (#275 live-complete) · **Live status:** **REMEDIATION RELEASED at `7152bc5`; journeys 8.2–8.6 await operator-provisioned throwaway artifacts**

## Findings — reported before remediation

This review stayed inside the remaining personal-account portal journeys 8.2–8.6. No invitation was consumed and no live project data was mutated.

| ID | Severity | New finding | Security/user impact |
|---|---|---|---|
| F-276-1 | P2 | The existing journey-8.5 race harness still called guest snapshot/RSVP RPCs anonymously, although migration 0021 requires a bound personal account for new email-backed invitations. | A correct production deployment would make the harness fail before the race; anonymous success would actually indicate an authorization regression. The harness could not certify the intended journey. |
| F-276-2 | P2 | Race readback expected each guest snapshot to expose the couple’s complete `coupleSubmissions` collection. The guest privacy projection exposes only that authenticated guest’s own `rsvp`. | The former oracle was impossible under the privacy contract and encouraged broadening data exposure merely to satisfy a test. |
| F-276-3 | P3 | Missing guest-B configuration silently reused guest A’s token. | A nominal “two-guest” run could exercise one principal twice and falsely pass without proving concurrency or account isolation. |
| F-276-4 | **P1** | Couple and guest cloud pull helpers collapsed authoritative `{ok:false}` responses (`expired`, `not_found`, `venue_unavailable`, or `account_required`) to `null`. Portal pollers treated `null` as a transient miss and retained their already-hydrated React state. | An already-open personal portal could continue displaying private event/guest content after token expiry, token reissue/revocation, venue suspension, or account mismatch. Server writes remained denied, but the visible portal did not close or explain the lost access. Journeys 8.3, 8.4, and 8.6 would therefore fail their open-session lifecycle requirement. |
| F-276-5 | P3 | The harness printed its mutation summary only after complete success and unconditionally re-accepted invitations even when the claim Function had already bound the account or the mapping was already active. The acceptance RPC updates the mapping timestamp. | A partial failure could leave account/binding/RSVP mutations unlogged, while successful reruns performed an unnecessary and uncounted binding write. This violated the throwaway-live mutation ledger and least-mutation requirements. |

## Remediation

### 1. Personal-account concurrency harness

`scripts/e2e-rsvp-concurrency.mjs` now enforces the actual migration-0021 contract:

1. require exactly two distinct guest tokens for one couple;
2. resolve both minimal invite contexts and require distinct participant IDs and normalized emails;
3. prove anonymous snapshot reads and RSVP writes return exact `account_required`;
4. create or hand off to each invited personal account independently;
5. sign in both guests separately and require distinct Auth user IDs and access tokens;
6. bind only an existing Auth account that is not yet mapped (newly created and already-claimed mappings are not redundantly accepted);
7. prove A cannot read or write with B’s token and B cannot read or write with A’s token;
8. prove each principal can read only its own projected guest snapshot;
9. issue both RSVP writes concurrently under separate JWTs; and
10. verify each guest’s own projected `rsvp` contains its unique race stamp.

The anonymous and cross-account write probes use an oversized payload. If an account gate regressed, payload validation would stop the call before any update; the negative probe therefore cannot become an RSVP mutation.

Configuration validation rejects missing/non-array guest lists, duplicate tokens, and noncompliant passwords. `--preflight` omits password requirements and performs only read/guaranteed-denial checks, so invitations can be validated before any account is created or bound.

### 2. Failure-safe, redacted mutation ledger

Every potentially mutating request is logged before dispatch with only the guest label and possible effect class. Confirmed durable effects are recorded as one of:

- throwaway Auth-user creation;
- portal-binding write; or
- RSVP write.

The ledger is emitted from `finally`, including on network rejection or a later failed assertion. Concurrent writes use `Promise.allSettled`, so one rejection cannot let the process exit while the other request is still unaccounted for. A request with no definitive response remains `indeterminate` and produces an explicit operator-reconciliation warning. Existing-account handoff is recorded as no persistent mutation, and redundant invitation acceptance was removed.

No email, token, password, JWT, response body, or participant/Auth identifier is printed. Error detail is restricted to HTTP status and a bounded machine error code.

### 3. Authoritative access-denial propagation

`pullCouplePortalSnapshot` and `pullGuestPortalSnapshot` now distinguish two failure classes:

- transport/backend reachability errors still resolve to `null`, preserving the existing quiet five-second retry behavior; and
- server-verified `{ok:false}` results throw a typed `PortalAccessError` carrying only a bounded machine code and generic message.

The guest and couple portal pollers recognize only that typed denial. They clear the local portal session; the guest path also clears hydrated guest, RSVP, event, and portal configuration state. Both surfaces then set the personal-account gate back to `pending`. The gate mounts afresh and displays the existing white-label invitation-expired, invitation-invalid, venue-unavailable, or sign-in state after its own authoritative context lookup.

The isolated portal Auth session is intentionally retained. Reissuing a token does not change the stable personal principal, so opening the replacement link can recognize the same account; the withdrawn old link still cannot render the portal. Venue/platform sessions and tenant organization data are untouched.

### 4. Regression coverage

Coverage now pins:

- exact anonymous `account_required` behavior;
- two-token and strong-password configuration requirements;
- absence of guest-A fallback;
- guest privacy-projected RSVP readback rather than full-couple submissions;
- bidirectional cross-account read/write denial;
- distinct Auth-user assertion;
- failure-safe mutation-ledger summaries and `finally` emission;
- no redundant acceptance after new/already-active bindings;
- authoritative couple and guest denial propagation for expiry, revocation/not-found, venue suspension, and account mismatch;
- transport failures remaining retryable;
- arbitrary backend text not being exposed as an access code;
- an already-open guest portal re-entering its account gate on the next denied poll;
- an already-open couple portal doing the same; and
- preservation of Review #268 transient-rejection handling while terminal denials take the new branch.

## Preservation and mutation boundary

No schema, migration, invitation, portal account, Auth user, RSVP, venue status, event, layout, guest list, membership, or other live project data changed during this review. The runtime correction changes only client handling of denials the backend already enforced. Historical invitations still use their established legacy path when migration context is genuinely unavailable or the invitation is not personal-account-marked.

The live harness requires environment-only credentials from a mode-0600 temporary file. It never accepts secrets as command arguments, never needs a service-role key, performs no administrative operation, logs no identity/credential value, and signs out both temporary personal sessions in `finally`.

## Verification gates

| Gate | Result |
|---|---|
| Harness syntax | `node --check scripts/e2e-rsvp-concurrency.mjs` passed |
| Focused lifecycle/harness tests | **4 files / 25 tests passed** |
| Full Vitest | **285 files passed, 4 skipped; 1,170 tests passed, 5 skipped** |
| Exact-SHA CI | GitHub run `33928549637` passed at `7152bc5411c92d4c7a03fdea81320501bdc446fa` |
| Production deployment | deployment `6274443440` succeeded at the same SHA; canonical root returned HTTP 200 and contained the new lifecycle marker |
| TypeScript | `npm run typecheck` passed |
| Strict production unused-locals audit | passed (`NO_UNUSED_PRODUCTION_ERRORS`) |
| ESLint | passed with **0 errors / 27 pre-existing warnings** |
| Typed event-bus lint | passed |
| `@ts-nocheck` ratchet | **0 / ceiling 0** |
| Dependency audit | `npm audit --omit=dev`: **0 vulnerabilities** |
| Single-file build/budget | passed — 2,254.92 KiB raw / 543.72 KiB gzip |
| Split build/budget | passed — largest chunk 680.79 KiB raw / 148.73 KiB gzip |
| Whitespace / credential checks | `git diff --check` passed; tracked+untracked token-shaped scan and non-placeholder diff-assignment scan returned 0 findings |

The first post-remediation full run found one stale static contract test that required the Review #268 comment to appear immediately after `catch`. The runtime behavior was correct; the pin was updated to require both branches—terminal denial re-gates, transient rejection retries quietly—and the complete suite then passed. Known non-failing React `act(...)`, jsdom canvas/navigation, and intentional corrupt-storage notices remain. Bundle and ESLint warnings match the pre-existing accepted baseline.

## Remaining live execution contract

The release prerequisite is satisfied: exact source SHA `7152bc5411c92d4c7a03fdea81320501bdc446fa` is CI-green and deployed. Do not run mutating mode or consume an invitation until all inputs below are operator-provisioned throwaway artifacts.

Required batch:

- two distinct email-backed, `personalAccountRequired` guest invitations for one throwaway couple, their known strong personal-account passwords, and couple ID;
- one fresh email-backed couple/collaborator invitation and known strong password for claim/reissue proof;
- explicit authorization for one throwaway venue to be suspended and reactivated;
- an operator-controlled expiry-edge invitation or authorization for the operator to move one throwaway guest token across its expiry boundary;
- canonical application URL and publishable/anon key only (never service role).

Every mutation will be logged as attempted, confirmed, no-change, or indeterminate. Suspension/reactivation and expiry administration remain operator-run unless an existing authorized product UI permits the specific throwaway action.

## Disposition

All Review #276 findings are remediated and pinned locally. Journey 8.5 tooling now proves personal-account isolation and the actual guest projection rather than legacy bearer behavior. Journeys 8.3/8.4/8.6 have deterministic coverage for closing already-open portals after authoritative lifecycle denial. White-label UX, stable participant/account identity, historical-link compatibility, tenant/session isolation, and wedding data are preserved.

Review #276 remediation is **RELEASE-COMPLETE; LIVE JOURNEYS PENDING**. Journeys 8.2–8.6 remain open until the operator supplies the batched throwaway artifacts above and each authorized sequence is executed and logged.
