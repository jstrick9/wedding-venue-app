# Review #270 — Phase 4 Batch 8: Deferred P5 Cleanup (PlatformVenueMap Highlight)

**Date:** 2026-09-01 · **Scope:** the deferred-P5 backlog from #263–#269 · **Baseline:** `4b10419` (#269, CI green)

## Finding fixed

### P5 (from #263): PlatformVenueMap selected-marker radius was frozen at map-build time

The Leaflet map effect deliberately excludes `selectedId` from its deps (`[useTiles, locatedKey]`) — rebuilding the map per selection click would tear down and re-create the tile layer + all markers (the freeze risk that motivated the original triage). But the marker radius highlight (`selectedId === id ? 10 : 7`) was computed inside that effect, so it was baked in with a stale closure: **selecting an organization in the tiled view never visually enlarged its marker** (the SVG fallback view, side panel, and popups all updated — only the radius highlight was stale).

**Fix:** circle markers are tracked in a `markersRef` map (aliased to a local inside the effect per the exhaustive-deps cleanup rule); a small effect keyed on `[selectedId]` calls `setRadius` on the existing markers. No map rebuild, no stale highlight. Radii constants shared between build and sync.

**Pinned by:** `src/components/platformVenueMapSelection.pin.test.ts` (4 tests).

## Remaining P5s — declined with reasons (final disposition)

| Item | Disposition |
|---|---|
| LodgingBuilder mid-drag staleness | Bounded (#263 triage): drag completes against the captured frame; no data loss. Cosmetic-only; churn not justified. |
| Portal chat `msgTick` 5s interval runs while chat tab closed | Bounded re-render; same pattern as CoupleManagement; refresh-on-open is the feature. |
| StaffOperationsPanel shift-time empty string (`fromLocalDatetimeInput('')` → `''`) | Self-heals on re-edit; NaN comparisons are false in conflict math (no crash). |
| Clipboard writes without catch | Callers pair with fallback toasts; optional chaining keeps unsupported browsers silent. |

## Gates

tsc 0 · vitest **1064 pass / 5 skip** (+4) · eslint 0 err / **28 warn** (baseline maintained — the new effect introduced no net warnings after the ref-alias pattern) · build gzip **546.81 kB** (≤620) · `npm audit --omit=dev` 0 · event-bus checker clean.

## Disposition

P5 backlog cleared (1 fixed, 4 formally declined). **Phase 4 is fully complete including backlog.** Campaign continues only on: Phase 3 live sign-in proof (blocked on operator artifacts — request 3.1 on the registry board), migrations 0018–0020 live application (operator-run, scripts provided), and the deferred live claim/RSVP E2E journeys (registry 8.x).
