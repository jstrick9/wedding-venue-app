# Review #268 — Phase 4 Batch 6: Unhandled-Rejections Sweep (Cross-Cutting)

**Date:** 2026-09-01 · **Scope:** every async surface that can reject into a `void` caller — portal cloud-sync pollers/saves, public branding RPC, chat panel, autocomplete, layout sync, clipboard writes · **Baseline:** `e938b55` (#267, CI green)

## Method

Enumerated `.then()` chains without catch, `void asyncFn()` call sites (78), and confirmed the rejection model of the HTTP layer: **`withTimeout` rejects** (does not resolve-with-error) on stall, so a stalled/offline Supabase call rejects through `.rpc()` to every caller that doesn't catch.

## Findings

### F-268-1 (P4, FIXED): portal cloud-sync paths leak unhandled promise rejections while offline

- **CouplesPortal `hydrateRemote`** (5s poll) and **GuestPortal `hydrateGuest`** (5s poll) both ran `try { … } finally { … }` with **no catch** — a network failure or fetch-deadline stall rejected straight through `void hydrateRemote()`/`void hydrateGuest()` → an **unhandled promise rejection every 5 seconds** for as long as the network was down. (The `pulling` guard and `finally` kept the poll honest — functionality recovered — but the rejection noise persisted.)
- **CouplesPortal `pushLocalSnapshot`** had no error handling at all: a failed save rejected through the 350ms debounce timer callback, the conflict-retry path, **and the #264 unmount flush**.
- **`getPublicVenueBranding`** awaited its RPC bare; both portals call it as `void … .then(…)` with no catch → unhandled rejection on portal load when offline.

**Fix:**
- Pull paths: quiet `catch` (console.debug) — the poll retries on its own; toasting every 5s while offline would be hostile.
- Save path: `catch` + **`emit('spm_cloud_sync_error', { domain: 'couple portal', … })`** — the established typed channel (Review #245 P2-F) whose root listener (App.tsx `GlobalCloudSyncErrorListener`) shows "Saved locally, but syncing … Your change is still on this device." The message is accurate: local storage owns the edit and the next change/visit re-pushes it.
- Branding service: whole body wrapped in `try { … } catch { return null; }` — branding is decorative; one fix covers both portal callers.

**Pinned by:** `src/components/portalRejectionHandling.pin.test.ts` (4 tests).

## Verified clean (with evidence)

| Surface | Verdict |
|---|---|
| `PlatformVenueChatPanel.load` | **Correction to #264:** it IS guarded — `loadInFlight` ref + `withTimeout(20s)` + catch with error surfacing. My #264 P5 ("no in-flight guard") was overstated; nothing to fix. |
| `AddressAutocomplete` | `withTimeout(15s).then(…).catch(…).finally(…)` — handled. |
| `useLayoutBackendSync` | load catch + save catch with `spm_cloud_sync_error` emit (#245 P2-F). |
| Lazy route imports | React Suspense owns those rejections. |
| Clipboard writes | `navigator.clipboard?.writeText(...).then(…)` — clipboard permission denials reject, but callers pair with fallback toasts for the copy-link actions (user gets feedback either way); optional-chaining keeps unsupported browsers silent. P5 declined. |
| `entityBackendSync` saves | Routed through `saveDomainToBackend` with catch → typed event (#245). |
| Remaining `void` sites | Event-bus emits, `setInterval`/timer callbacks (sync), and service calls whose layers catch internally (verified for the couple/guest portal service family this batch). |

## Gates

tsc 0 · vitest **1056 pass / 5 skip** (+4) · eslint 0 err / **28 warn** (baseline) · build gzip **546.64 kB** (≤620) · `npm audit --omit=dev` 0 · event-bus checker clean.

## Disposition

**Phase 4 protocol item "unhandled rejections" → COMPLETE.** Protocol checklist now: subscription/event-bus cleanup ✓ (#263), conditional-hooks ✓ (#263), timer/store races ✓ (#264), giant-file hotspots ✓ (#265–#267), unhandled rejections ✓ (this review). Remaining open: state-machine completeness + optimistic-update rollback (both substantially exercised by the flow audits — recommend closing them formally next batch against the evidence already recorded), plus the P5 backlog.
