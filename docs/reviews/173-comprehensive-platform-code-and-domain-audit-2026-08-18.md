# Review #173 — Comprehensive Whole-Repository Code, Security, Architecture & Wedding-Venue Domain Audit

**Repository:** `jstrick9/wedding-venue-app-old`  
**Branch / baseline:** `main` at `9254f03` (`docs(ai-agent): Review #172...`)  
**Review date:** 2026-08-18  
**Review scope:** Full repository, including runtime code, tests, documentation, Supabase migrations, and the transactional-email Edge Function.

> This is an audit and production-readiness assessment. Runtime code was not changed in this pass; the permanent AI-agent memory, review ledger, and this detailed report were updated so remediation can be executed deliberately and with traceability.

---

## 1. Executive conclusion

This is an unusually broad **local-first wedding venue operations and layout-planning product**. It is not merely a floor-plan toy: the model covers venue spaces, seating, chairs, linens, fixtures, lodging, decor, layout review, couple events, packages/add-ons, guest events, RSVP, wayfinding, rain contingencies, weather, vendors, staffing, timelines, BEO printing, branding, backup/recovery, and role-aware workflows.

The local mode is the current product reality and is in good shape for a **single-browser demo, workshop, or single-device venue planning tool**. The repository also contains a substantial Supabase design, but the cloud mode is presently a **partial synchronization layer**, not a production-complete multi-tenant platform. Several release-blocking defects sit in the cloud bootstrap, RLS, guest portal RPC, role mapping, and local/cloud data boundary.

### Production verdict

| Mode | Assessment |
|---|---|
| **Local / offline** | Strong feature breadth; suitable for demos and controlled single-device use, subject to backup/token/privacy limitations. |
| **Supabase / multi-user** | **Not production-ready without the P0 remediation below.** Account bootstrap, organization access, most couple/guest data, staff/admin settings, and server-side guest flows are not yet end-to-end connected. |
| **Hosted static bundle** | Default single-file build is green and portable, but `build:split` is broken and the bundle still references external Google Fonts. |

The most important architectural decision is now explicit: either (a) finish the backend as the authoritative source of truth, or (b) label the product honestly as local-first and remove/relabel cloud claims. Do not present the current hybrid as fully shared, secure, or real-time across every workflow.

---

## 2. Repository inventory and method

I inspected the full tracked repository rather than only the obvious entry points:

- **539 tracked files** / approximately **98,464 lines**.
- **169 non-test runtime source files** and **174 test files** under `src/`.
- **181 documentation files**, including the long numbered review history, roadmap, platform docs, and AI-agent memory.
- **5 Supabase files**: four migrations and the `send-email` Edge Function.
- Static searches covered storage keys, event-bus use, backend imports, unsafe casts, `@ts-nocheck`, direct browser APIs, file inputs, raw storage writes, route/hash handling, RLS policies, grants, indexes, and persistent-domain registry coverage.
- Runtime validation included the default CI gates plus explicit checks of the split build, coverage script, dependency audit, and repository cleanliness.

### Validation baseline

| Check | Result |
|---|---|
| `npm ci` | Pass. |
| `npm run typecheck` | **Pass**, zero TypeScript errors. |
| `npm run lint:events` | **Pass**, no raw `spm_*` event-bus calls outside the typed bus. |
| Unused-locals scan (`tsc --noEmit --noUnusedLocals`, test files filtered) | **Pass**. |
| `npm run test` | **729 passed / 11 skipped**, across **167 passed / 7 skipped test files**. |
| `npm run build` | **Pass**; `dist/index.html` 1,793.06 kB, 409.39 kB gzip. |
| `npm run test:coverage -- --reporter=dot` | **Fails** because `@vitest/coverage-v8` is not installed. |
| `npm run build:split` | **Fails**: Vite cannot resolve `yjs`, referenced by stale `manualChunks` configuration. |
| `npm audit` | One high advisory in transitive dev tooling (`nanoid` through `postcss`/Vite); production-only audit reported no vulnerabilities in this environment. |
| Live Supabase migrations | **Not executed**; no project URL/anon key or live database was provided. SQL findings below are static review findings and must be verified against a real project before launch. |

The 11 skipped tests are concentrated in collision integration, the authenticated shell smoke mount, Admin fixture/seating expansion, password-reset completion, seating properties, and table↔room assignment. These are meaningful workflow areas, not harmless unit-test trivia.

---

## 3. Current architecture map

```text
index.html / main.tsx
        |
        v
      App.tsx  -- hash routing for dashboard, studio, admin, couples portal,
        |       guest portal, accept-invite
        |
        +-- AuthProvider / AuthContext
        |     +-- local PBKDF2 auth + local sessions
        |     +-- optional Supabase Auth session
        |     +-- forced temporary-password gate
        |
        +-- CouplesPortal                 #/couples-portal
        +-- GuestPortal                   #/guest-portal
        +-- AuthenticatedApp               #/dashboard, #/studio, #/admin, #/venuemap
              +-- VenueDashboard
              +-- Header / Sidebar / FloorPlanCanvas / PropertiesPanel
              +-- AdminPanel and 20+ admin sub-editors
              +-- StudioLayoutsHome / VenueMapDesigner
              +-- Operations / Timeline / Vendors / Chat / Print / approval modals
```

### Persistence lanes

1. **Raw localStorage lane** (`src/data/venueData.ts`, `useLayoutState`, several admin settings): plain JSON under `spm_*` keys.
2. **Versioned localStorage lane** (`src/utils/storage.ts` and domain services): envelopes containing `{ version, savedAt, data }`, migrations, corruption backups, and typed storage-error events.
3. **Supabase lane**:
   - Auth and organization membership tables.
   - A dedicated `layouts` table for saved layouts.
   - A generic `org_data` JSON key/value table for 28 catalog/settings domains.
   - Public guest RPCs, object storage, invites, and an email Edge Function.
4. **Same-browser collaboration lane**: `BroadcastChannel` and local revision/edit-session records. This is useful between tabs on one browser/device, but is not a substitute for cloud synchronization.

`useLayoutState.ts` remains a very large hook/service hybrid. It owns React state, raw persistence accessors, layout mutations, guest assignment, CSV export, master layouts, saved layouts, templates, and decor access. This is workable for the local product but is the main coupling point that makes backend adoption, authorization, and transactional writes difficult.

---

## 4. What is strong and should be preserved

### 4.1 Wedding-venue domain coverage

The strongest part of the product is the domain model. It reflects real venue work rather than generic event CRUD:

- Multiple venue spaces with indoor/outdoor/lodging categories and custom shapes.
- Table types, seating-only ceremony rows, chair layouts, chair counts, linens, fixture types, walls, architectural features, and exterior inventory.
- Clearance rules for walls, tables, fixtures, dance floors, buffets, aisles, and accessibility.
- Couple-owned guest lists, event-specific guest invitations, plus-ones, meal choices, dietary notes, special accommodations, table/seat/room assignments, multi-day attendance, and per-event RSVP.
- Lodging floors, rooms, capacity, furniture, room assignment, and room-level drill-in.
- Packages, seasonal prices, guest/overnight limits, lodging inclusions, paid add-ons, derived guest events, and venue setup/staffing tasks.
- Venue-controlled property map, GPS points, routes, rain-contingency spaces, rules, weather, and couple-scoped map presentation.
- Operations checklists, shifts, conflict warnings, search/filtering, reset-for-next-event, BEO roll-up, and print output.
- Approval workflow with per-space status, review comments, review history, and layout-review pins.

### 4.2 Engineering foundations

- PBKDF2-SHA256 password records with random salts, session versions, lockout state, timing-safe comparison, and a forced password-change gate for the shipped temporary admin credential.
- Typed event bus with an enforcing linter; this prevents the previous class of silent cross-component event regressions.
- Versioned storage envelopes and corrupt-payload backup/recovery paths.
- CSV formula-injection protection in the shared guest CSV utility.
- Undo/redo, dirty-state navigation guards, saved-layout overwrite confirmation, and reset-on-layout-replacement behavior.
- Shared map renderer used in admin, couple, guest, print, and export contexts.
- Strong local test culture: domain services and pure utilities are well represented, and the default build is green.
- Accessibility effort exists: labels, `aria-pressed`, `aria-selected`, focus trap utility, live-region notifications, reduced-motion CSS, and modal semantics.

---

## 5. Persona and workflow assessment

| Persona | Delivered value | Current operational limitation |
|---|---|---|
| **Venue admin** | Catalog, branding, roles, access, map, packages, questions, users, backup, audit UI. | Admin UI is local-state oriented; cloud role/membership management is not wired to the UI; backup is incomplete and contains secrets. |
| **Venue manager** | Dashboard KPIs, couples pipeline, calendar, approvals, chat, operations, BEO. | Calendar does not enforce true time/space double-booking; booking/contract/deposit/revenue lifecycle is not a source-of-truth workflow. |
| **Venue operations staff** | Pull/checklists, shifts, areas, conflict badges, BEO print, reset-for-next-event. | Staff data is not shared in cloud mode; BEO sign-off is a print placeholder rather than a persisted approval/signature record. |
| **Booked couple** | Invite link, questions, spaces, multi-day design, packages/add-ons, guest events, guests, vendors, checklist, timeline, chat, portal settings. | Couple/event/guest/chat/package data remains local; bearer tokens are client-readable; there is no authoritative server-side couple tenancy. |
| **Planner / day-of coordinator** | Layout studio, master layouts, timeline, approval, operations, BEO, print/export. | Same-browser collaboration is not cross-device; rotation-aware safety and true operational lock/version control are incomplete. |
| **Wedding guest** | Mobile portal, token/name/email lookup, RSVP, meals, plus-one, schedule, lodging, map, GPS, rules, weather, calendar export. | Supabase guest identity has no end-to-end publisher from couple records, server RSVP RPC has correctness/security defects, and local fallbacks can report success when server persistence fails. |
| **Preferred vendor** | Venue-curated directory, category filtering, preferred badge, contact links, couple selection. | There is no vendor self-service account/workspace; vendor payment/contract workflows were intentionally removed, so the product should not imply vendor CRM/accounting. |

### Domain gaps that matter to a real venue

1. **Booking/availability is date-level, not operationally complete.** The calendar flags blocked-plus-couple contradictions, but it does not robustly prevent two booked events from occupying the same space at overlapping times, nor does it model setup/tear-down buffers, venue-wide blackout windows, or a venue's multi-space concurrency rules.
2. **Inventory warnings are not enforcement.** Tables and fixtures have inventory counts, but chair inventory is displayed as a warning and placement is not blocked; linens and many decor consumables are not reconciled as a formal pull/return inventory ledger.
3. **Layout safety ignores rotation.** Collision and wall checks use axis-aligned boxes while the data model supports `rotation`. A rotated table/fixture can visually overlap or breach a wall without the same result appearing in the validation model.
4. **Operational BEO is mostly a generated document.** It contains useful sections but does not have persistent BEO versions, explicit approval state, signed actor/time records, change diffs, or a locked “issued” version.
5. **Metrics have parallel sources.** The older event overview reads `useLayoutState.guests` while the couple platform stores guests/RSVPs in separate couple-scoped services. Without an explicit projection, venue metrics can be empty or stale even when a couple has a real guest list.

---

## 6. Release-blocking findings (P0)

### P0-1 — Supabase sign-up cannot reliably bootstrap the first organization membership

**Evidence:** `AuthBackend.signUpWithSupabase()` inserts an organization and then inserts an `organization_memberships` row. The migration's only membership write policy is `membership_manage_admins`, whose `with check` calls `has_org_role(...)`. The new owner has no active membership yet, so the initial membership insert is rejected by RLS. The client ignores the membership insert error and returns a session with an organization id anyway.

**Impact:** A newly registered venue can appear signed in but has no active organization membership. RLS-scoped reads/writes fail or return empty data, and the user cannot use the platform as the owner.

**Fix:** Use a transaction/secure bootstrap RPC or a narrowly scoped policy/trigger that permits the authenticated organization owner to create exactly the first owner membership. Check and surface every insert error. Add a live Supabase integration test that creates an auth user, organization, owner membership, catalog row, and layout row under RLS.

### P0-2 — Cloud mode is not the complete data provider advertised by the product

`SupabaseEntityRepository` syncs only 28 catalog/asset-style domains. The running app's couple and guest platform data is still stored in localStorage. Important unsynced domains include, among others:

- couple events, couple answers, couple submissions, couple messages, couple guests, portal configs;
- couple checklists, couple vendors, couple setup tasks, wedding packages, add-ons, guest events;
- venue calendar events, venue map configs, venue rules, weather, vendor categories;
- couple/legacy RSVP stores, direct messages, communication templates, operations settings, security settings, and local users.

There is no repository that maps the local `CoupleEvent` / `CoupleGuest` model into the relational Supabase `events` / `guests` tables. The public guest RPC therefore has no reliable producer from the couple portal.

**Impact:** Two users can sign in to the same organization and still see different couples, guests, packages, staff data, portal settings, maps, and messages. A second device can silently show seeded defaults. The product cannot be described as a shared multi-user wedding venue platform until domain ownership is explicit and all critical workflows use it.

**Fix:** Make a domain-by-domain source-of-truth matrix. Implement repositories/transactions for every P0 domain, or explicitly disable those features in Supabase mode. Do not silently fall back to local persistence after a cloud write failure.

### P0-3 — Public guest RSVP RPC has both a security gap and a likely runtime error

`supabase/migrations/0002_guest_portal.sql`:

- `submit_guest_rsvp()` validates only the token hash; it does **not** check `portal_access.enabled`, access start/end, event status, or RSVP deadline.
- It builds `submitted_ip` by taking the JWT `sub` claim and casting it to `inet`. A JWT subject is an auth identifier, not an IP address; a non-IP value will cause the insert to fail. The request IP must come from a trusted server/header strategy or be left null.
- The function deletes and reinserts the guest's RSVP without an idempotency key or rate limit.
- `get_guest_by_portal_token()` returns the full `portal_access` JSON object; only explicitly safe fields should be returned.

**Impact:** Direct RPC callers can submit after the UI says access is closed, and normal anonymous RSVP submissions may fail in the database. The UI currently optimistically writes local data and shows the success state even when the Supabase call returns `false`.

**Fix:** Enforce all access and deadline rules in the RPC, remove the invalid IP cast, add an idempotent upsert keyed to guest/event, validate field lengths/enums, add abuse/rate limits, return only safe fields, and make the client show a server failure rather than a false success.

### P0-4 — Supabase `owner` is mapped to local `basic`, breaking authorization after reload

`AuthBackend.mapRole()` only maps `admin`, `staff`, and `guest`; `owner` and `planner` fall through to `basic`. `canAccessAdminPanel()` requires `user.role === 'admin'`. Sign-up temporarily returns a local `admin` user, but a restored or freshly signed-in owner becomes `basic` and loses admin access. `InviteMembers` is then inaccessible even though the database membership is owner.

**Fix:** Define a single role mapping (`owner` → admin-equivalent, planner → planner/manager policy, couple → couple) and use it consistently in UI gates and backend policies. Add sign-in and restore tests for every Supabase role, including a page reload.

### P0-5 — Password reset and “Continue as Planner Guest” are not safe production boundaries

The visible `PasswordReset` component always looks up local users and creates a local reset code. It never calls the otherwise-unused `requestSupabasePasswordReset()` path. In a Supabase deployment, a cloud user cannot use the displayed forgot-password flow. In non-test/non-demo mode the component does not deliver the code anywhere.

The login screen also always offers “Continue as Planner Guest,” including when Supabase auth is enabled. That path creates a local guest session and mounts the local workspace. It must not be treated as a security boundary or a production access path for organization data.

**Fix:** In Supabase mode use Supabase Auth recovery exclusively and handle the recovery callback. Disable local password reset and planner-guest workspace access in production/cloud mode, or make guest access an explicitly isolated read-only demo dataset.

---

## 7. High-priority findings (P1)

### P1-1 — `org_data` RLS grants every active organization member read/write access to every domain

Migration `0003_org_data.sql` uses the same `is_org_member(organization_id)` policy for select, insert, update, and delete. The JSON table contains branding, RBAC roles/groups/audit, staff, vendor, question, layout-adjacent, and other administrative domains.

**Impact:** UI visibility is not authorization. A planner or staff member who can call Supabase directly can write `rbacRoles`, overwrite venue settings, read unrelated staff/admin data, or replace catalog data. This defeats least privilege.

**Fix:** Split sensitive domains into relational tables with role-aware policies, or use a server-side RPC with an allowlisted domain and role check. Never expose a generic all-domain write surface to every org member.

### P1-2 — Entity pulls bypass the event bus, so the active UI can remain stale

`SupabaseEntityRepository.pullAll()` writes directly through `BACKUP_DOMAINS[].write()`. Those writers use raw `localStorage` or `saveVersionedStorage()` and do not emit `spm_data_changed`. The `useEntityBackendSync` callback only refreshes saved layouts; it does not refresh the catalog/admin component state.

**Impact:** A fresh cloud login can pull remote venues/specs/config into storage after React components already initialized with defaults, while the visible UI continues showing stale local data until a reload. This makes cloud synchronization appear intermittent.

**Fix:** Use typed repository state updates, emit a domain-specific event after each successful pull, or hydrate the app before rendering the authenticated workspace. Add a test that starts with seeded local defaults, pulls a different remote catalog, and asserts the rendered catalog changes without a page reload.

### P1-3 — Backend domain event names do not match repository keys

The event bus emits values such as `chairs`, `spacing`, `venue-map`, `couples`, and `couple-chat`, while the backup/entity registry expects `chairSpecs`, `spacingSettings`, `venueMapConfigs`, and has no matching couple domains. `AuthenticatedApp` skips `all` events for backend domain pushes.

**Impact:** Chair and spacing edits, couple changes, map changes, and chat changes do not reach Supabase through the advertised entity-save path. This is a silent data-loss/split-brain failure.

**Fix:** Replace free-form strings with a shared `EntityDomain` union; have each setter emit the exact registry key; handle `all` via a bounded domain list or explicit transaction. Do not allow `(string & {})` to erase type safety for persistence events.

### P1-4 — Layout cloud save is destructive replace-sync and is unsafe for collaboration

`SupabaseLayoutRepository.saveAll()` deletes every layout for the organization and reinserts the caller's entire local list. It does not preserve database row ids, uses a fixed revision of `1`, does not create `layout_versions`, and does not use optimistic concurrency.

**Impact:** Two users saving at the same time can delete each other's saved layouts. Realtime emits a storm of delete/insert events, and one device can overwrite the other device's changes. This is the opposite of a safe collaborative source of truth.

**Fix:** Upsert one layout row at a time using a stable client/database id, increment revisions, write a version record, and reject stale `expected_revision` updates. Use a transaction or server RPC for batch operations. Treat layout metadata and payload as separately versioned fields.

### P1-5 — Empty remote layout results are ignored

`pullLayouts()` only writes to local storage when `remote.length > 0`. If the server correctly has zero layouts, stale local layouts are retained. `useLayoutBackendSync.loadedRef` also prevents a retry after a failed first pull and is not reset if the organization context changes.

**Fix:** Always replace the local layout list with the remote result, including an empty array; expose sync status and retry; reset load state when user/org changes.

### P1-6 — Couple/guest tokens and portal secrets are client-readable and use weak local generation

Local couple invite tokens, collaborator tokens, guest tokens, portal password fallbacks, and many event records are stored in localStorage. Several tokens/ids use `Math.random()` plus timestamps. `getCoupleTokenFromLocation()` also leaves the couple token in the URL/history while the guest token path attempts to remove it.

This is acceptable only for a deliberately local demo. It is not server-side guest identity or tenant isolation. The BEO and admin UI also display raw portal/invite tokens, and the printable BEO includes a “Portal Reference Token,” which is inappropriate for a document that may be printed or shared with operations staff.

**Fix:** Generate bearer tokens with Web Crypto, store only hashes server-side, remove tokens from URLs with `history.replaceState`, never print raw tokens, and scope every portal query by event/couple on the server.

### P1-7 — RBAC still has two authorities and role short-circuits bypass granular revocation

The code contains the granular `PERMISSIONS`/`useRBAC` system and legacy `UserPermissions` flags. `permissions.ts` grants admin/staff broad access by early return, so an RBAC role cannot revoke layout/guest/operations access from those users. `canAccessAdminPanel()` and `canAccessOperationsPanel()` are based on the legacy role string, not the granular registry.

The bridge also references unregistered permission ids (`admin.users.invite`, `layout.view.all`, `templates.delete`), and role inheritance has no cycle detection.

**Fix:** Choose one authoritative authorization service. Resolve role membership and permissions once, fail closed, enforce the same result in UI and backend, validate permission ids at save time, and detect inheritance cycles.

### P1-8 — Backup/restore is not complete and exports security material in cleartext

`BACKUP_DOMAINS` is a strong single registry, but it does not include all persistent domains. At minimum, the registry misses `coupleSubmissions`, `communicationTemplates`, `operationsSettings`, and `securitySettings`; local invite records and other session/read-marker data are also outside the advertised “complete” backup. `BackupPayload` contains `coupleSubmissions` but no registry entry ever writes it.

The exported JSON includes user PBKDF2 hashes/salts, portal password fields, couple/guest invite tokens, and other bearer credentials. The backup checksum detects accidental modification but does not provide confidentiality.

**Fix:** Reconcile `STORAGE_KEYS` → backup registry with a tested completeness check; classify session/secrets explicitly; redact or encrypt password/token material; require an export confirmation and a passphrase/key-management policy for production restores.

### P1-9 — Public/server guest mode is disconnected from couple guest management

`SupabaseGuestPortalBackend` can call the public token RPC, but the app never publishes local `CoupleGuest` records to the relational `guests` table. The couple portal loads `getCoupleGuests()` from localStorage, while the server RPC reads `public.guests`. Therefore the link generated by the couple portal is not enough to make the server portal work.

**Fix:** Either implement a transactional couple-event/guest projection and publish/revoke tokens server-side, or keep the feature local and do not claim server-side guest auth is active.

### P1-10 — File upload guidance is documented but violated in multiple runtime paths

The memory rules correctly require `sr-only` inputs and labels, but the code still uses `className="hidden"` or programmatic hidden inputs in:

- `CouplesPortal` guest CSV import;
- `DrawingTool` image upload;
- `GuestPanel` CSV import;
- `StaffOperationsPanel` JSON import;
- `BackupManagement` backup import;
- `UserManagement` avatar upload;
- `AdminPanel` dynamically created file input.

Several `FileReader` paths lack the guarded completion/error/fallback pattern documented in the memory file.

**Impact:** Browser security restrictions, keyboard/screen-reader failures, WebView/jsdom differences, and inconsistent error handling remain likely in operational workflows.

**Fix:** Standardize one accessible `FileInput`/upload utility, validate MIME/size, use labels, handle `onload`/`onerror`/`onloadend` exactly once, and test keyboard, touch, cancel, corrupt file, and quota-exceeded paths.

### P1-11 — Supabase invite acceptance does not refresh the active AuthContext

The `accept_invite` RPC creates/updates membership, but `AcceptInvite` only clears the hash after a timeout. It does not rehydrate `AuthContext` or reload the Supabase session, despite its copy saying it is reloading.

**Impact:** A newly accepted member can remain scoped to the old/no organization until a manual page reload.

**Fix:** Add an `refreshSession()`/organization-selection action to AuthContext and call it after acceptance; handle multiple memberships explicitly rather than selecting `.limit(1)` arbitrarily.

---

## 8. Medium-priority findings (P2)

1. **Type-safety debt:** 24 runtime files use `// @ts-nocheck`; runtime source contains approximately 177 `any` word occurrences / 91 `as any` casts. The largest components are thousands of lines long (`CouplesPortal`, `GuestPortal`, `StaffOperationsPanel`, `AdminPanel`, `UserManagement`, `FloorPlanCanvas`). The green typecheck does not represent those files' real safety.
2. **Split build is broken:** `vite.config.ts` still declares `manualChunks` for removed `yjs`/`y-websocket` packages. Either remove the entries or restore and actually wire the collaboration dependency.
3. **Coverage command is broken:** install `@vitest/coverage-v8` or remove `test:coverage` from the advertised scripts.
4. **Skipped tests are concentrated in high-risk UI:** collision drag/click/property paths, Admin fixture/seating expansion, password reset completion, seating properties, table↔room transition, and full authenticated-shell mounting should be addressed before calling the suite comprehensive.
5. **No live backend or browser E2E gate:** Supabase tests are mocks; there is no migration/RLS smoke test, no Playwright/Cypress journey, no axe-based accessibility gate, and no cross-device collaboration test.
6. **External resource contradiction:** `index.html`, `src/index.css`, and dynamic branding load Google Fonts. The single-file bundle is self-contained in JS/CSS, but typography still makes external network requests. Weather, Google Maps, Supabase, signed images, and transactional email are also external by design. Document “offline core” rather than “zero external network calls,” or self-host fonts.
7. **Favicon/path issue:** `index.html` references `/vite.svg`, which is not a tracked project asset and is absolute rather than relative for the `file://` bundle.
8. **Documentation drift:** `README`, `QUICKSTART`, `docs/CODE_REVIEW.md`, `docs/platform/PLATFORM.md`, and the pre-audit memory contain older test counts, old admin/guest navigation, old paths, and/or stronger cloud claims than the current code supports. This review and the updated memory are the current source of truth.
9. **Modal a11y inconsistency:** `ModalDialog` uses `useFocusTrap`; `ConfirmDialog` only focuses the confirm button and handles Escape. It does not trap Tab focus or restore focus, despite its documentation claiming a focus trap.
10. **Storage writes are not transactional:** many domain services read a whole array, mutate it, and write it back. Two tabs can lose updates; localStorage quota failures can leave UI state and persistence state out of sync. The same pattern appears in direct messages, couple services, calendar services, and admin settings.
11. **Image quota risk:** local mode stores raw data URLs, with several uploads allowed up to 5–10 MB. A venue catalog can exceed browser quota quickly. Compress/resize locally or make object storage mandatory for hosted mode.
12. **Dependency advisory:** the one `npm audit` high advisory is in transitive build tooling (`nanoid` under `postcss`/Vite), not the production dependency graph reported by `npm audit --omit=dev`; still track it through dependency updates.
13. **URL trust boundary:** venue website/vendor URLs and image/SVG references are loaded from editable/imported data. Validate allowed `https:`/`mailto:`/`tel:` schemes and sanitize external links before rendering or opening.

---

## 9. Recommended remediation roadmap

### Phase 0 — Make cloud mode honest and safe

1. Fix owner organization bootstrap with a transaction/RPC and verify real RLS behavior.
2. Map Supabase roles correctly and add auth/session recovery tests.
3. Decide and document the authoritative provider per domain. Disable or visibly label any local-only cloud-mode feature.
4. Complete the couple/event/guest projection before enabling server guest portal links.
5. Repair the guest RPC: access window, deadline, idempotency, safe return fields, rate limiting, and IP handling.
6. Replace destructive layout replace-sync with row-level optimistic upserts and revisions.
7. Tighten `org_data` or replace it with domain-specific tables/RPCs and least-privilege policies.
8. Fix password reset and remove/isolates planner guest access in production mode.

### Phase 1 — Data integrity and security hardening

1. Unify RBAC and make it fail closed across UI and backend.
2. Make repository pulls hydrate active state and make all domain event keys typed/consistent.
3. Reconcile the complete backup registry; add redaction/encryption for credentials/tokens and test restore of every domain.
4. Remove raw tokens from BEO/print/UI outputs; use cryptographically secure tokens and server-side hashes.
5. Standardize file uploads and URL validation.
6. Add database indexes for `org_data`, `org_invites`, and token lookup fields; verify query plans in a real project.

### Phase 2 — Quality and maintainability

1. Remove `@ts-nocheck` one module family at a time, starting with auth/admin/couple/portal paths.
2. Split `useLayoutState`, `CouplesPortal`, `GuestPortal`, and `UserManagement` into domain hooks and services.
3. Re-enable skipped tests and add live Supabase/RLS, browser E2E, axe, and multi-tab/device tests.
4. Repair `build:split`, coverage tooling, favicon, documentation, and offline-font strategy.

### Phase 3 — Venue intelligence that differentiates the product

1. Add a real booking pipeline: lead/hold/booked/contracted/paid/completed/cancelled, deposits, cancellation rules, and audit history.
2. Add space/time conflict detection with setup/tear-down buffers and multi-space concurrency rules.
3. Make chair/linen/decor inventory a real pull/return/reconciliation workflow rather than advisory counts.
4. Add issued BEO versions, change diffs, sign-off actors/timestamps, and lock-after-issue behavior.
5. Project RSVP/plus-one/meal/room data into venue-level operational KPIs and catering counts.
6. Add decision-support metrics: capacity health, rain-contingency readiness, setup workload, vendor arrival conflicts, timeline dependency warnings, and incomplete approval blockers.

---

## 10. Permanent source-of-truth file map for future agents

| Concern | Authoritative files |
|---|---|
| App routing/auth gate | `src/App.tsx`, `src/contexts/AuthContext.tsx`, `src/services/backend/AuthBackend.ts` |
| Local persistence | `src/utils/storage.ts`, `src/constants/storageKeys.ts`, `src/constants/storageVersions.ts` |
| Raw catalog/legacy persistence | `src/data/venueData.ts`, `src/hooks/useLayoutState.ts` |
| Event bus | `src/utils/appEvents.ts`, `scripts/check-event-bus.mjs` |
| RBAC | `src/constants/permissions.ts`, `src/hooks/useRBAC.ts`, `src/utils/rbacBridge.ts`, `src/utils/permissions.ts` |
| Backup/recovery | `src/utils/backupDomains.ts`, `backupExport.ts`, `backupImport.ts`, `recovery.ts` |
| Couple platform | `src/services/couples/*`, `src/components/CouplesPortal.tsx` |
| Guest platform | `src/utils/guestPortal.ts`, `src/services/portal/guestPortalBackend.ts`, `src/components/GuestPortal.tsx` |
| Venue operations | `src/components/StaffOperationsPanel.tsx`, `src/services/calendar/*`, `src/components/VenueCalendar.tsx` |
| Layout/collision | `src/components/FloorPlanCanvas.tsx`, `src/hooks/useLayoutState.ts`, `src/utils/collisionDetection.ts`, `src/utils/spaceSeating.ts` |
| Cloud persistence | `src/services/repository/*`, `src/services/sync/*`, `supabase/migrations/*` |
| Transactional email | `src/services/backend/EmailService.ts`, `src/services/couples/coupleEmailService.ts`, `supabase/functions/send-email/index.ts` |
| AI-agent memory | `docs/AI_AGENT_MEMORY.md` |

Future agents must read the current audit snapshot in `docs/AI_AGENT_MEMORY.md` before changing backend, auth, persistence, portal, or backup code. Historical numbered reviews are valuable context but may describe an earlier commit and must not override current source behavior.

---

*End of Review #173.*
