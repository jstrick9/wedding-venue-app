# Review #264 — Phase 4 Batch 2: Stores/Race & Timer-Cleanup Sweep (Console Flow Audit)

**Date:** 2026-09-01 · **Scope:** 4.13 remainder — timer/interval cleanup drops, async poller overlap, cross-tab store write races · **Baseline:** `f2bc682` (#263, CI green)

## Method

1. **Timer-cleanup sweep** — all 19 `clearTimeout`/`clearInterval` cleanup sites triaged for *dropped work*: a cleanup that cancels a pending async action without performing or flushing it.
2. **Async poller overlap** — every `setInterval` callback that awaits (`void fn()`): checked for in-flight guards and out-of-order-resolution hazards.
3. **Store write races** — localStorage read-modify-write sequences and cross-tab interaction with the `storage` event and CAS cloud sync.

## Findings

### F-264-1 (P4, FIXED): CouplesPortal drops the final debounced cloud save on unmount

`src/components/CouplesPortal.tsx` cloud-sync effect: the `spm_data_changed` handler arms a 350ms debounce (`cloudSaveTimerRef`) that fires `pushLocalSnapshot()`. The effect cleanup cleared the timer **without flushing the pending save**. A couple who edits data and closes/navigates away from the portal inside the 350ms window loses the upload entirely — the cloud snapshot stays stale until a later mount happens to change data again. With the 350ms window armed on every keystroke-class mutation, "edit then close" is a common exit path, so stale-remote-after-reopen was a realistic user-visible failure (other devices hydrate the old state).

**Fix:** cleanup now flushes — `if (cloudSaveTimerRef.current) { clearTimeout(...); void pushLocalSnapshot(); }`. Safe during teardown: `pushLocalSnapshot` performs no `setState`; it only reads local storage state, calls `saveCouplePortalSnapshot` (CAS + conflict retry), and may re-hydrate via `hydrateRemote()` (itself guarded by `cancelled`/`pulling`). The flush runs only when a save was actually pending, so a no-edit teardown stays a no-op. Old-closure flush on dep change is correct behavior (it saves the state that scheduled it).

**Pinned by:** `src/components/portalSaveFlush.pin.test.ts` (2 tests — flush present in cleanup; flush guarded).

## Clean / Declined (with reasons)

| Site | Verdict |
|---|---|
| `AdminPanel.tsx:526` `successTimerRef` | Toast auto-hide timer — dropping it on unmount is the *desired* behavior (toast dies with the panel). Benign. |
| `withTimeout` + `supabaseClient.ts` fetch deadline timers | Cancellation-only timers (no deferred work). Benign. |
| Remaining 16 timer sites (LoginScreen, PasswordReset countdowns, CouplesPortal:396/442 tick timers, CoupleManagement:85/99, layout/save UI timers) | All either fire-and-forget UI ticks or clear-then-rearm with no deferred unit of work. Clean. |
| `useLayoutBackendSync.ts` | No debounce at all — `saveToBackend()` is flush-at-call-time from save/delete handlers; realtime sub returns its unsubscribe; pull retries on next mount after failure. Clean. |
| CouplesPortal `hydrateRemote` / GuestPortal `hydrateGuest` 5s pollers | Already guarded by in-flight `pulling` flag + post-await `cancelled` check (#245 P1-A) — serialized, no stacking, no out-of-order apply. Clean. |
| `PlatformVenueChatPanel.tsx:61` `load()` 10s poll, **no in-flight guard** | **P5, declined:** each load *replaces* message state so a slow/out-of-order response self-heals on the next tick; client-level fetch deadline bounds stacking; realtime sub is the primary path and polling is the fallback. Not worth churn now. |
| Cross-tab localStorage races | Write paths are full-domain writes from the owning tab; JS is single-threaded so intra-tab read-modify-write is atomic; other tabs refresh via the `storage` event. Couple-portal multi-device writes are mediated server-side by CAS snapshots (`coupleCloudSync.cas.test.ts`). No interleaving hazard found. |
| `useLayoutState` fresh-object-per-render (`[layoutState]` deps) | Already triaged #263: perf smell, correctness-safe. |

## Gates

tsc 0 · vitest **1043 pass / 5 skip** (+2) · eslint 0 err / **28 warn** (unchanged, triaged #263) · build gzip **546.51 kB** (≤620) · `npm audit --omit=dev` 0 · `@ts-nocheck` ceiling 0 · event-bus checker clean.

## Disposition

4.13 (event-bus + store correctness) → **COMPLETE**. Next: giant-file console flows — 4.10 (CouplesPortal deep) → 4.11 (GuestPortal) → 4.9 (StaffOperationsPanel) → 4.7 (FloorPlanCanvas). Deferred P5s carried: PlatformVenueMap Leaflet selected-radius freeze; LodgingBuilder mid-drag staleness; PlatformVenueChatPanel unguarded poll (this review).
