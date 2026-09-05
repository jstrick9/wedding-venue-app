# Review #277 — Venue Portal / Venue Map Designer

**Date:** 2026-09-05

**Persona:** Wedding-venue owner/admin/planner

**Scope:** Property-map authoring, wayfinding, persistence, cloud/realtime behavior, exports/print, accessibility, and dependent couple/guest portal renderers. Floor-plan tooling was changed only where a shared export or persistence dependency required it.

## Executive result

The Venue Map Designer has been remediated locally from a mostly visual, weakly scoped map into a canonical property-map and authored-wayfinding workflow with layered publication controls:

- **Guests:** public layers only, scoped to their wedding's selected spaces and rain backup spaces.
- **Couples/collaborators:** public plus couple-visible layers; staff-only layers are excluded from portal snapshots.
- **Venue staff:** all layers.
- **Server boundary:** guest RPCs rebuild an allowlisted projection from the authoritative organization map at response time. Client hiding and cached guest projections are not trusted as privacy controls.

No commit, push, deployment, credential use, or live mutation was performed. Migration `0023_venue_map_guest_projection_and_assets.sql` remains undeployed and must precede the client release.

## Workflows reviewed and exercised

### Property-map authoring

- Map creation and resizing
- Point placement, selection, drag/move, keyboard nudge, duplication, editing, and deletion
- Point types: event space, parking, entry/exit, amenity, and path node
- Venue linkage, descriptions, abstract coordinates, and optional GPS coordinates
- Public, couple-only, and staff-only audience selection
- Event-space scoping
- Base-map URL, local image import, private cloud upload, opacity, replacement, and removal
- Undo/redo and dirty-state navigation protection

### Authored wayfinding

- Named walkway creation from ordered point sequences
- Route editing, point reordering, rename/delete, notes, audience, and event scope
- Venue-verified step-free, not-step-free, and unverified mobility states
- Guest route generation over authored graph edges only
- Explicit no-route and no-verified-step-free outcomes
- Rain-backup inclusion
- Retirement of the legacy second destination-authoring surface

### Zones and presentation

- Canonical vector zones, preset zones, editing, audience, and event scope
- Couple and guest previews
- Shared map renderer in the designer, Couples Portal, and Guest Portal
- Legend/title rendering; no existing third-party map attribution paths were removed

### Output and persistence

- Print, PNG, and PDF output
- Embedded/signed/remote raster handling and explicit export failures
- Versioned local persistence and backup import normalization
- Organization-domain push/pull, realtime refresh, and stale-request cancellation
- Couple snapshot construction, hydration, compare-and-swap writer flow, and guest response RPCs
- Private organization-scoped map-image storage

### Accessibility and input

- Pointer, mouse, and touch placement/drag behavior
- Keyboard point selection and movement
- Read-only button semantics only when a real action exists
- GPS-gated external map actions
- Couple-space actions only for eligible linked event/lodging spaces
- Accessible SVG naming, text alternatives, focus behavior, and polite wayfinding status updates

## Findings and disposition

| ID | Severity | Finding | Local disposition |
|---|---:|---|---|
| F-277-1 | P1 | Pointer coordinates were wrong when rendered and authored aspect ratios differed. | Fixed and regression-tested. |
| F-277-2 | P1 | Drawing Studio could destructively replace canonical map state. | Replaced with canonical zone editing. |
| F-277-3 | P1 | Guest directions could invent routes instead of following venue-authored paths. | Replaced with authored graph routing and explicit no-route states. |
| F-277-4 | P1 | Guest event-space scope was not consistently applied. | Applied to points, routes, zones, spaces, and rain backups. Missing guest event context now fails closed to global non-space layers. |
| F-277-5 | P0 | A shared browser cache could briefly expose a previous tenant before hydration. | Added exact-context hydration gate, complete-domain reset, generation checks, and stale/unmounted pull guards. |
| F-277-6 | P1 | Map saves could miss portal snapshot invalidation. | Canonical domain mapping and snapshot invalidation added; duplicate save notification/full refresh removed. |
| F-277-7 | P1 | SVG/PNG/PDF output could be malformed, incorrectly scaled, or silently omit images. | Export normalization, PDF generation, image inlining, bounds, and explicit failure behavior corrected. |
| F-277-8 | P1 | Hash/back/refresh navigation could bypass unsaved-map protection. | Dirty navigation, browser unload, cancel, and destination restoration guarded. |
| F-277-9 | P1 | No enforceable layered visibility model existed. | Added audience and event-scope contracts for points, routes, and zones; malformed explicit metadata fails closed. |
| F-277-10 | P1 | Base-map images could create unsafe/unbounded persistence and storage behavior. | Added bounded raster-only validation, private organization paths, signed URLs, active-organization policies, and a dedicated bucket. |
| F-277-11 | P1 | Canvas interactions were mouse-centric and read-only pins could expose no-op controls. | Added pointer/touch/keyboard parity and action-availability semantics. |
| F-277-12 | P2 | Guest Portal retained a dead second wayfinding source of truth. | Removed its CRUD UI; legacy data remains stored for compatibility but is not shipped as guest wayfinding. |
| F-277-13 | P1 | Background/annotation layers could block point placement. | Made noninteractive layers pointer-transparent and tested placement over them. |
| F-277-14 | P1 | Couple/collaborator snapshot writers could replace venue-controlled map data. | Migration locks the row, preserves the venue map, strips submitted map fields, and regenerates the guest cache. |
| F-277-15 | P1 | Venue-member bulk hydration could overwrite canonical globals with a stale/couple-filtered snapshot and remove staff map layers. | Bulk snapshot hydration now merges couple-owned domains only; `org_data` remains canonical for venue globals. |
| F-277-16 | P1 | Backend pull notifications could be mistaken for local edits, causing redundant writes or realtime pull→push loops. | Added typed event provenance; UI refreshes backend data while write bridges ignore backend-originated events. |
| F-277-17 | P1 | Guest projection used a snapshot map copy, so a failed snapshot refresh could leave a formerly public layer exposed. | Guest RPC now prefers authoritative `org_data.venueMapConfigs` at response time, with a protected legacy fallback only when no domain row exists. A present canonical JSON `null` cannot resurrect a stale map. |

## Privacy and data-contract rules now enforced

- A missing legacy `audience` is public for compatibility.
- An explicitly invalid, blank, or null audience fails closed as staff-only/excluded.
- An absent or empty event scope means global; malformed/null scope fails closed.
- The internal malformed-scope sentinel can never become visible even if supplied as a selected-space ID.
- Unknown/internal object fields are removed by allowlist reconstruction.
- Routes are omitted unless every route point survives projection.
- Guest space points must match the selected or rain-backup venue IDs.
- Only explicitly verified `step-free` routes satisfy the step-free filter.
- Couples cannot submit either `venueMapConfigs` or `guestVenueMap` through the snapshot writer.
- Guest RPCs do not trust a submitted or cached `guestVenueMap`.
- Canonical organization JSON `null` returns no map rather than falling back to a stale snapshot.
- Storage access requires an active organization plus an active authorized membership/account.

## Validation evidence

### Final repository gates

- **Vitest:** 288 files passed, 4 skipped; **1,216 tests passed**, 5 skipped; 0 failed.
- **TypeScript:** `npm run typecheck` passed.
- **ESLint:** `npm run lint` completed with **0 errors**; 26 repository warnings remain, principally existing React hook dependency warnings.
- **Typed event bus:** `npm run lint:events` passed.
- **Production build:** passed; 289 modules; single-file output 2,329.88 kB, gzip 561.22 kB.
- **Type-safety ratchet:** 0 runtime `@ts-nocheck` files, ceiling 0.
- **Whitespace/conflicts:** `git diff --check` passed; no conflict markers found.
- **Dependencies:** restored with `npm ci`; `package.json` and `package-lock.json` are unchanged.

### Database validation

A transient PGlite harness applied migrations **0001 through 0023** and functionally verified:

- authoritative organization-map precedence,
- protected legacy snapshot fallback,
- canonical JSON-null behavior,
- public/audience/event projection,
- route/zone/point allowlisting,
- malformed metadata fail-closed behavior,
- couple-writer map preservation,
- guest cache regeneration,
- helper-function execute revocation,
- guest-wrapper execution grants,
- private bucket size/type bounds, and
- active-organization storage predicates.

Persistent migration contract tests also pass 4/4.

## Release sequencing — mandatory

1. Review and commit the local change set.
2. Apply migration **0023** before releasing the client.
3. Release the client only after migration success is confirmed.
4. Use operator-provisioned throwaway venue/couple/guest artifacts for live canary verification.
5. Verify public/couple/staff projection, event scoping, suspension behavior, private image access, and writer preservation.
6. Do not use a service-role key in the client, workspace, or source control.

Releasing the client first is unsafe because pre-0023 guest RPCs return the broader snapshot map.

## Residual risks and recommended next work

These do not invalidate the local remediation, but should remain explicit:

1. **Orphaned map images:** replacing or abandoning an uploaded base map does not delete the old private object. Add reference tracking plus delayed garbage collection.
2. **Concurrent venue-admin edits:** map publication is still last-write-wins at the generic organization-domain layer. Add revision/CAS semantics and an editor conflict UI before promoting multi-admin simultaneous authoring.
3. **Legacy image references:** old `sp://venue-images/...` references may not be readable by portal-only accounts. Re-upload those maps into `venue-map-images` during rollout rather than widening the general venue-image policy.
4. **External HTTPS base maps:** remote images may be blocked by CORS during export; the app now fails explicitly rather than producing an incomplete file. Private upload is the recommended production path.
5. **Physical scale and walking time:** the map uses abstract units. Calibrated distance/time estimates require an approved scale model and unit UX; this is a product/schema enhancement rather than something to infer.
6. **Test noise:** existing React `act(...)`, jsdom navigation/canvas, and hook-dependency warnings remain visible despite green gates.
7. **Live verification:** no production or Review #276 live probe was run because approved throwaway artifacts and credentials were not provided.

## Current source state

- Branch: `main`
- Base/remote SHA: `335630f1a420a88dd634c8045c3a799ac52d3ebc`
- Worktree: dirty, uncommitted
- Deployment: none
- Live mutations: none
