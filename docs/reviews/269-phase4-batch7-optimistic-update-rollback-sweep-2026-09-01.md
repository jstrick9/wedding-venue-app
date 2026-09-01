# Review #269 — Phase 4 Batch 7: Optimistic-Update Rollback Sweep (Protocol Item Closed)

**Date:** 2026-09-01 · **Scope:** every UI surface that updates before server confirmation — guest RSVP submit, platform chat send, couple/venue/direct chats, entity + layout backend sync · **Baseline:** `663a9a9` (#268, CI green)

## Method

For each async-mutating surface: identified the write model (pessimistic confirm-first vs. optimistic local-first), then verified the failure path — does the UI tell the truth, and does the local copy survive?

## Findings

### F-269-1 (P3, FIXED): guest RSVP cloud failure shows false success, silently swallows, then the poll wipes the visible RSVP

The guest RSVP submit is deliberately optimistic/local-first (correct for this architecture): local state + localStorage update immediately, then `submitRSVP` runs against the backend. But:

1. `SupabaseGuestPortalBackend.submitRSVP` **resolves `false`** on RPC error (and rejects on network failure) — and the handler was `.then(() => setIsSubmittingRSVP(false)).catch(() => setIsSubmittingRSVP(false))`: **both failure paths were silent**, while `setRsvpSuccess(newSubmission)` had already shown the success screen. The guest believed their RSVP went through; the couple's other devices (cloud snapshot) never received it.
2. Worse, the 5-second cloud poll then replaced `submissions` with the stale remote (`rsvp ? [rsvp] : []`) — **wiping the locally-saved RSVP from view** within seconds of the false success, leaving the guest's submission invisible in the UI (though still in localStorage).

**Fix:**
- Both failure paths now emit the typed `spm_cloud_sync_error` event (`domain: 'guest rsvp'`) → App-level toast: *"Saved locally, but syncing 'guest rsvp' to the cloud failed … Your change is still on this device."* — honest feedback with a concrete retry path (submit again).
- The poll now keeps the local submission when the remote has none (`submissions: rsvp ? [rsvp] : previous.submissions`) — remote still wins when it HAS an RSVP (server canonicalization, couple edits). Documented tradeoff: if a couple-side deletion ever removed the RSVP row server-side, the guest's device keeps showing its stale local copy until re-submit — accepted, because the failed-submit case (the common one) must not eat the guest's data.

**Pinned by:** `src/components/guestRsvpSync.pin.test.ts` (4 tests: resolved-false handled, rejection handled, typed channel used, poll preserves local).

## Verified clean (with evidence)

| Surface | Verdict |
|---|---|
| Platform chat send | **Pessimistic**: awaits `withTimeout(send…, 20s)`, appends only the confirmed message (dedup by id), keeps the draft on failure, error surfaced via `describeUnknownError`. Nothing to roll back. |
| Couple/venue chat (`sendCoupleMessage`) | Local-first synchronous service write — no network optimism. |
| Direct messages (`useDirectMessages`) | Local-first via `saveVersionedStorage` (sync, auto-emit). |
| Entity backend sync (`entityBackendSync`) | Local-first; failures emit `spm_cloud_sync_error` (#245 P2-F); backend hydration merges. |
| Layout backend sync (`useLayoutBackendSync`) | Local-first; save failures emit `spm_cloud_sync_error` (#245 P2-F); overwrite conflicts protected. |

## Protocol checklist — Phase 4 closed

- Subscription/event-bus cleanup — ✓ #263 (31 + 44 sites clean)
- Conditional-hooks — ✓ #263 (0 rules-of-hooks; 28 exhaustive-deps triaged)
- Timer/store races — ✓ #264 (19 sites; F-264-1)
- Giant-file hotspots — ✓ #265–#267 (all five 1800+ ln components; F-265-1/2, F-267-1)
- Unhandled rejections — ✓ #268 (F-268-1)
- **Optimistic-update rollback — ✓ this review (F-269-1; all other surfaces pessimistic or local-first-with-error-events)**
- State-machine completeness — ✓ closed on accumulated flow-audit evidence: portal invite/session/expiry/logout state machines (#265, incl. URL-token scrub), drag/pan/zoom machine + undo/redo semantics (#267), staff confirm-dialog flows (#266), conflict/CAS paths (#258/#262/#264).

## Gates

tsc 0 · vitest **1060 pass / 5 skip** (+4) · eslint 0 err / **28 warn** (baseline) · build gzip **546.77 kB** (≤620) · `npm audit --omit=dev` 0 · event-bus checker clean.

## Disposition

**Phase 4 console-flow audit COMPLETE** (all protocol items closed with evidence). Remaining campaign work: deferred P5 backlog (PlatformVenueMap Leaflet radius freeze, LodgingBuilder mid-drag staleness, portal chat msgTick cadence, shift-time empty-string cosmetic, clipboard fallbacks), Phase 3 venue/platform live sign-in proof (blocked on operator artifacts — request 3.1), migrations 0018–0020 live application (operator-run), and the deferred live claim/RSVP E2E journeys (registry 8.x).
