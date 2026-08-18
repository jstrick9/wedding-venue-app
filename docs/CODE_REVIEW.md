# Wedding Venue Intelligence Platform — Historical Comprehensive Code Review

> **Superseded notice (2026-08-18):** This is the 2026-08-03 historical review and its backend findings/test counts are not the current repository truth. Read `docs/reviews/173-comprehensive-platform-code-and-domain-audit-2026-08-18.md` and Section 9 of `docs/AI_AGENT_MEMORY.md` for the current full-repository audit at the latest `main` baseline.

**Repo:** `jstrick9/wedding-venue-app-old` (historical branch `main`, head `c26cdc2`)
**Reviewed by:** full-stack + wedding-venue domain expert
**Date:** 2026-08-03

> Every claim below was verified by reading the source and by executing the project's own validation pipeline:
> `npm run typecheck` (✓ clean), `npm run lint:events` (✓ clean), `npm run test` (✓ **231 passed / 11 skipped / 64 files**), and `npm run build` (✓ single-file bundle builds).

---

## 0. Fix Log — committed to `main` (2026-08-03)

The following fixes were implemented and committed as part of this review (all validated with the project's own CI: typecheck ✓, event-bus lint ✓, **234 tests ✓**, production build ✓):

| ID | Fix | Files |
|---|---|---|
| **CRITICAL-2** | **Forced password change on first login.** Authenticated users with `requiresPasswordChange` are now blocked from the workspace and shown a mandatory "Set a New Password" screen until they create a credential; `AuthContext.changePassword()` hashes the new password (PBKDF2), clears the flag, and bumps `sessionVersion`. This closes the hole where the default `REPLACE_ON_FIRST_LOGIN` admin credential could be used indefinitely. | `src/contexts/AuthContext.tsx`, `src/components/ForcePasswordChange.tsx` (new), `src/App.tsx`, `src/contexts/AuthContext.test.tsx`, `src/App.forcePasswordChange.test.tsx` (new) |
| **HIGH-6** | **Added DB indexes** on every foreign key / frequently-filtered column across all 18 tables (incl. `audit_logs.created_at` used by the email rate-limiter). | `supabase/migrations/0001_initial.sql` |
| **MED-8** | **Removed unused `yjs` / `y-websocket` dependencies** (were never imported). | `package.json`, `package-lock.json` |
| **storage consistency** | **Hardened the raw `loadFromStorage`/`saveToStorage`** in `venueData.ts` to match the versioned layer: corrupt data is backed up (`spm_backup_*`), load/save failures emit `spm_storage_error` (surfaced as toasts), and saves re-throw on failure so callers don't act on unsaved data. | `src/data/venueData.ts` |

**Deferred (larger refactors not done this pass to avoid destabilizing the 234 green tests):**
- Wiring the Supabase backend into the running app (CRITICAL-1) — requires a live Supabase project + deployment, not just a code change.
- Server-side guest-portal auth (CRITICAL-3) — depends on the backend being live.
- Full storage-system unification and full RBAC reconciliation (HIGH-5/HIGH-7) — multi-file refactors recommended as their own workstream with dedicated test coverage.

---

## 1. Executive Summary

This is a feature-rich, **localStorage-first** wedding venue **floor‑plan / layout‑planning** application (product name "Seven Paths Manor") built as a single‑page React app. It has grown into a substantial system:

- **~41,500 lines** of application TypeScript/TSX (excluding tests) + **~6,400 lines** of tests.
- A genuinely deep **wedding-venue domain model** (tables, chairs, linens, fixtures, walls, spacing/collision rules, decor designer, ceremony seating rows, lodging, guest assignment, staff operations, vendor management, timeline, RSVP guest portal).
- A thoughtfully **hardened local auth layer** (PBKDF2‑SHA256 password hashing, session versioning, lockout, typed event bus, storage versioning/migrations, corruption recovery, backup/restore).
- A well-run **test suite** (231 passing) and a clean CI pipeline.

**However, the headline finding is an architecture-level disconnect:** the product is branded an *"Intelligence Platform"* and ships a complete **Supabase production backend** (Postgres schema + RLS, Edge Function email, object storage, auth backend, database service), yet **none of that backend is actually wired into the running application.** The app runs entirely on `localStorage`. The Supabase code is dead scaffolding — impressive on paper, but it means the platform has **no real multi-user data, no server-side security, and no true real-time collaboration** today.

Everything below is organized to give you: (1) how the app maps to real wedding-venue operations, (2) what is genuinely strong, (3) the critical security/architecture issues, and (4) a prioritized action plan.

---

## 2. Architecture Map

```
index.html ─ main.tsx ─ App.tsx
                          ├─ AuthProvider (AuthContext)
                          │    └─ local PBKDF2 auth  OR  (unused) Supabase AuthBackend
                          ├─ ModalProvider
                          ├─ AppContent
                          │    ├─ GuestPortal (lazy)  ← hash-based route #/guest-portal
                          │    └─ AuthenticatedApp (lazy)
                          │         ├─ Header / Sidebar / FloorPlanCanvas / PropertiesPanel
                          │         ├─ Modal panels (lazy): AdminPanel, GuestPanel,
                          │         │   DecorDesigner, StaffOperations, PrintView,
                          │         │   TemplateSelector, DirectMessage, Timeline,
                          │         │   VendorPanel, SubmissionStatus, EventQuestions
                          │         ├─ UndoRedoProvider
                          │         └─ AppStatusBar (health/safe-mode)
```

**Persistence model (the core reality):**
- Everything is stored in `localStorage` under namespaced keys (`spm_*`).
- Two **parallel storage systems** coexist:
  1. **Versioned storage** (`src/utils/storage.ts`) — enveloped `{version, savedAt, data}`, with migrations + corruption backup + typed `spm_storage_error` events. Used for config, saved layouts, decor, guest portal, RBAC.
  2. **Raw `loadFromStorage`/`saveToStorage`** (`src/data/venueData.ts`) — plain `JSON.parse`/`setItem` with no versioning. Used for **venues, table specs, fixtures, guidelines, templates, users, linens, wall styles, spacing, decor items/categories**.
- This **split is a maintenance and data-integrity hazard** (see §6).
- All state flows through the `useLayoutState` hook, which is simultaneously a **state hook and a data-access/service layer** (it exports `getUsers`, `setVenues`, etc.).

**Backend (present but not connected):**
- `supabase/migrations/0001_initial.sql` — 18 tables, RLS, helper functions, storage buckets, updated-at triggers. **No indexes on FKs, no seed data.**
- `supabase/functions/send-email/index.ts` — Resend-based transactional email Edge Function with role checks + rate limiting. **Well-written but unreferenced by the frontend.**
- `src/services/backend/` (`AuthBackend`, `EmailService`, `supabaseClient`) and `src/services/storage/ObjectStorageService` and `src/services/DatabaseService` — **none are imported anywhere in the app** (verified by grep). Only `shouldUseSupabaseAuth()` / `signInWithSupabase` are reachable, gated behind `VITE_BACKEND_PROVIDER='supabase'`.

---

## 3. Wedding-Venue Domain Model — Feature Inventory & Fit

This is where the app genuinely shines. As a venue operator or planner, the coverage is unusually broad:

| Domain | What exists | Verdict |
|---|---|---|
| **Tables & seating** | Round 4/5/6ft, rect 6/8ft, sweetheart, head table, cocktail, ceremony rows; capacity, chair type, chair layout (`all-sides`, `long-sides`, `head-table`, `custom`), linen colors (15 presets) | Strong |
| **Chairs** | 8 chair types w/ inventory, dimensioned specs | Strong |
| **Fixtures** | DJ, bar, buffet, dance floor, altar, aisle runner, architectural (doors/windows/columns), interior/exterior/lodging categories, visibility/lock/permanent flags | Strong |
| **Spacing/collision** | `collisionDetection.ts` (477 lines) — item/wall/fixture/table spacing, collision warnings, overrides | Strong |
| **Ceremony seating** | Chair rows w/ styles (straight/curved/diagonal/stadium/semicircle), facing direction | Strong |
| **Guest management** | Assign to tables & lodging rooms, capacity checks, CSV import/export (formula-injection safe), dietary/accessibility/RSVP | Strong |
| **Lodging** | Multi-floor, rooms, furniture (beds, bathrooms, etc.), room assignment + capacity | Strong |
| **Decor designer** | Decor catalog (florals/candles/centerpieces/arches…), arrangements, packages/styles, placed-decor on tables/fixtures | Strong |
| **Templates** | Classic reception, banquet, ceremony, cocktail templates + admin template manager | Good |
| **Guest portal** | Password/token gate, map, schedule, wayfinding, RSVP w/ meal/dietary, lodging info; event-scoped; access grace period (B-06), schedule publish (B-09) | Strong (see security caveats) |
| **Staff operations** | Tasks w/ phases/priority/checklists, areas, shifts, export | Good |
| **Vendors** | Vendor list w/ categories, payments | Moderate |
| **Timeline** | Event schedule mgmt | Moderate |
| **Submission workflow** | Basic→admin layout approval queue | Good |
| **Direct messages / collaboration** | `BroadcastChannel` + revision-based conflict detection | See §5 limitation |
| **RBAC** | Role/permission registry, audit log, role templates | Strong, but see §5 |

**Domain expertise assessment:** The domain modeling reflects a real understanding of venue operations — e.g. separation of **table type vs. seating type**, **linen palette management**, **dance-floor buffer + aisle-width + buffet-clearance guidelines** (exactly the clearance rules a caterer/planner cares about), **wheelchair-accessible path enforcement**, and **lodging room capacity** for multi-day "wedding weekend" venues. These are the details that make it credible as a venue tool rather than a generic floor-plan toy.

---

## 4. What Is Genuinely Strong (keep these)

1. **Auth hardening.** Local auth uses PBKDF2-SHA256 with per-user random salt, 120k iterations, timing-safe comparison, session versioning (kicks out stale sessions on password/status change), 5-strike lockout with a **persisted** `lockedUntil` (so page refresh can't reset the lock), legacy-plaintext migration path, and password-reset flow with codes. The comment-driven design (B-06/B-07/B-09 fixes) shows iterative, deliberate bug-fixing.
2. **Typed event bus.** `src/utils/appEvents.ts` centralizes all `spm_*` window events behind a compiler-checked map (`emit`/`on`), plus a lint script (`check-event-bus.mjs`) that forbids raw `dispatchEvent`/`addEventListener` on `spm_*`. This is an excellent pattern that prevents the exact class of "button silently does nothing" regressions. Notably there is a test + lint enforcing it.
3. **Storage resilience.** Versioned envelopes with migrations, corrupt-data backup (`spm_backup_*`), `spm_storage_error` events surfaced to UI, a **project-health/recovery** module (builds a health report, emergency snapshot, auto-repair of corrupt domains), and backup/import/export utilities.
4. **CSV safety.** Guest CSV export prefixes formula-leading cells (`=`, `+`, `-`, `@`) with `'` to prevent spreadsheet formula-injection — a nice security detail most apps miss.
5. **Testing culture.** 231 passing tests across 64 files, including meaningful domain regression tests (guest room capacity, seating capacity rows, decor save, guest-portal event scoping, cross-role sidebar visibility). CI runs typecheck → lint → tests → build.
6. **Accessibility effort.** Focus trap hook, `LiveRegion`, `aria-selected`/`role="tablist"` in the guest portal, `SafeImage`, modal focus management, keyboard shortcuts. Genuine effort, not an afterthought.
7. **Code-split build modes.** `vite.config.ts` supports both a single-file `file://` mode (default) and a chunked, manual-chunked server mode — thoughtful deployment flexibility.

---

## 5. Critical Findings

### 🔴 CRITICAL-1 — The Supabase "production backend" is not wired in
`DatabaseService`, `EmailService`, `ObjectStorageService`, `AuthBackend` (beyond a gated flag), and the entire SQL schema + Edge Function are **unreferenced dead code**. The app's data, users, guests, layouts, RSVPs, messages, and staff data all live in `localStorage` on the visitor's own browser.

**Consequences:**
- **No cross-device, cross-user data.** A couple planning at home and the venue coordinator at the office see different data; "the platform" has no shared source of truth.
- **No server-side authorization.** RLS in the migration is never exercised; the client-side RBAC is the *only* gate.
- **Data loss risk.** Clear browser storage/cache = wiped plans. No server backup exists for real data.
- The send-email, storage, and version-history features documented in `README`/`docs` **cannot actually run** through the UI.

> This is the single most important thing to understand about the product: the "Intelligence Platform" backend is scaffolded but unplugged.

### 🔴 CRITICAL-2 — Default admin credentials are guessable and never force a password change
- `defaultUsers` ships `admin` / password **`REPLACE_ON_FIRST_LOGIN`** with `requiresPasswordChange: true`.
- But `canUserAuthenticate()` (in `src/utils/auth.ts`) **does not check `requiresPasswordChange`**, and neither the `AuthContext.login()` flow nor `LoginScreen` enforces a forced change.
- On a fresh deployment, `getUsers()` falls back to `defaultUsers`, so `hasLocalAccounts` is true and the "local accounts disabled in production" hint **never appears**.
- Login uses the legacy plaintext fallback (`user.password === password`), so typing the well-known default string logs you in as **admin**.
- **Fix:** treat `requiresPasswordChange` as a login gate (allow login, then force the change), and/or make the default admin a boot-time-only credential with a required setup, and/or ship with **zero** default users and force provisioning. Also consider removing the plaintext fallback from `verifyPassword` entirely (it's only for migration and is a foot-gun).

### 🔴 CRITICAL-3 — Guest portal "security" is client-side only
Portal password hash/salt and per-guest tokens live in `localStorage`/`sessionStorage` and are verified in the browser (`verifySecret`). The "access end" / grace-period logic is also client-side. Anyone with the app open in the same browser can read/clear these values, and there's no server to enforce access windows or brute-force limits. **This is acceptable only as a convenience gate for a static single-file app — it is not real security for a multi-tenant "platform."** When the Supabase backend is wired in, portal auth must move server-side (hash in DB, RLS, token + rate limiting in the Edge Function).

### 🟠 HIGH-4 — "Real-time collaboration" is same-browser-only
`collaborationChannel.ts` uses the **`BroadcastChannel` API**, which only communicates between tabs of the **same browser on the same device**. The edit-session + revision-conflict system is genuinely good (conflict detection, `layout-saved` notifications, session TTL), but it cannot support two people on different computers. Combined with `yjs`/`y-websocket` being installed but **unused**, the collaborative story is not what the architecture implies.

### 🟠 HIGH-5 — RBAC has two competing systems
There's a rich, modern RBAC system (`useRBAC`, `PERMISSIONS` registry, roles, audit log) **and** the older `UserPermissions` flags (`canEditLayout`, `canManageGuests`, …) checked in `permissions.ts`. The app's actual gating (`canAccessAdminPanel`, `canEditLayout`, etc.) uses the **legacy flags**, while the RBAC roles/registry/audit is largely a parallel, not-fully-integrated system. This creates confusion about which permission set is authoritative and risks a "works in the panel but not enforced" gap.

### 🟠 HIGH-6 — No DB indexes on foreign keys
The entire migration uses `references ...` but **zero** `create index` statements (verified). At even modest scale, org-scoped queries joining `organization_memberships`, `layouts`, `events`, `audit_logs` (used by the email rate-limiter) will degrade. Add indexes on every FK + frequently-filtered column (`organization_id`, `event_id`, `user_id`, `created_at`).

### 🟠 HIGH-7 — `useLayoutState` is a monolith and the data-access split is fragile
`src/hooks/useLayoutState.ts` (989 lines) is simultaneously a React hook and the **service layer** (it exports `getUsers`/`setUsers`/`getVenues`/`setVenues`, etc.). It's imported by auth, guest portal, and many components. Mixing mutable global data access with hook state makes the system hard to reason about and easy to break. The dual storage systems (§2) compound this — some domains are versioned, others aren't, so a migration bump on one side can silently diverge.

### 🟡 MED-8 — Dead dependencies bloat the bundle
`yjs` and `y-websocket` are dependencies but **never imported** (verified). The default build inlines **everything** into a single `index.html` of **~1.2 MB (271 KB gzipped)** — largely because `inlineDynamicImports: true` collapses all the `React.lazy()` chunks. The `npm run build:split` path exists to mitigate this, but the default is heavy. Remove unused deps; consider making chunked the default for hosted deployments.

### 🟡 MED-9 — Type safety erosion (118 `any` uses)
Despite `strict: true`, there are ~118 `any`/`as any` usages (e.g. `addDecor(parentType: any)`, `Partial<any>` updates, `getDecorPackages(): any[]`). Combined with `noUnusedLocals: false` / `noUnusedParameters: false`, the compiler lets a lot slip. These are concentrated in the decor and integration layers — exactly where the P0 "Decor save" fix lived, which suggests the loose typing correlates with the bug-prone areas.

### 🟡 MED-10 — 11 skipped tests signal unstable areas
The 11 skipped tests cluster around **AdminPanel fixtures/tables/seating expansion**, **PropertiesPanel seating**, and **layout assignment transition** — i.e. the seating/collapse UI. Skipped tests are a smell that these areas are either mid-refactor or flaky. They should be un-skipped and stabilized, or removed with a documented reason.

### 🟡 MED-11 — Accessibility/mobile polish
`index.html` uses `Cache-Control: no-store` and `<meta http-equiv="Pragma">` which will fight any future static-host/CDN caching. Also, several big interactive components (Sidebar, AdminPanel) rely heavily on `onMouseDown`/drag; mobile/touch parity is not proven by the test suite. Verify keyboard + touch behavior for drag/drop and admin grid editing.

---

## 6. Code-Quality & Maintainability Notes

- **Good:** strict mode, path alias `@/`, consistent `spm_*` namespacing, versioned constants (`storageKeys`, `storageVersions`), centralized event bus, small focused utils with tests, and a coherent file naming convention (`X.test.ts` colocated).
- **Watch:** dual storage systems; monolith hook-as-service; `any` in decor layer; two RBAC models; `console.log`/`console.warn` scattered (17, incl. a `✅ Supabase connected` in `DatabaseService` that's misleading given it's unused); duplicated data access (both `useLayoutState` and `venueData` expose `getDecorPackages`/`setDecorPackages`).

---

## 7. Testing & CI Assessment

- **CI (`ci.yml`) is correct and green locally:** typecheck → event-bus lint → vitest → build.
- **Coverage breadth is impressive** for this domain (guest room capacity, seating capacity, decor persistence, guest-portal event scoping, RBAC visibility, lockout flow, storage migrations, backup import/export, recovery).
- **Gaps:** no component tests for the drag/drop canvas interactions, no a11y snapshot/axe tests, and **no integration test that exercises the guest portal end-to-end against the guest-identity flow across all tabs**, no tests at all for the (unused) backend services.
- 11 skipped tests are a red flag to reconcile (MED-10).

---

## 8. Production-Readiness Verdict

**As-is, this is a well-built single-user/single-device local tool.** It is **not** production-ready as a multi-tenant "Intelligence Platform," because the backend that would make it one is disconnected and there is a real default-admin credential issue. It is, however, in a very good position to become production-ready: the hard parts (domain model, auth primitives, RBAC design, schema + RLS, edge-function email, storage policies, recovery, tests, CI) are all largely written — they just need to be **connected and enforced**.

---

## 9. Prioritized Action Plan

### P0 — Ship-stopping (do first)
1. **Wire in the Supabase backend** (or explicitly descope it). Either make `useLayoutState`/guest portal/vendors/messages actually read/write the DB service with RLS, or remove/relabel the dead backend so the product is honestly documented as "local-first."
2. **Fix the default-admin credential hole:** enforce `requiresPasswordChange` as a forced-change gate, ship zero default users (provision at setup), or require a generated password on first run. Remove the legacy plaintext password fallback.
3. **Move guest-portal auth server-side** once the backend is live (token hash in DB, RLS-gated, rate-limited RSVP submission).

### P1 — High value
4. Add **FK indexes** to the migration (`organization_id`, `event_id`, `user_id`, `created_at`, `actor_id`).
5. **Unify the two storage systems** (route all domains through versioned storage) and decouple `useLayoutState` into a real service layer + hooks.
6. **Reconcile RBAC:** make the role/permission registry authoritative and have `permissions.ts` consult it; remove/alias the legacy `UserPermissions` flags.
7. Replace the `BroadcastChannel` collaboration with a real transport (the already-installed yjs/WebSocket, or Supabase Realtime) for cross-device sync — or descope "collaboration."

### P2 — Polish & scale
8. Remove unused deps (`yjs`, `y-websocket`) or actually use them; default hosted builds to the **chunked** mode to cut the 1.2 MB single file.
9. **Un-skip and stabilize the 11 skipped AdminPanel/seating tests.**
10. Eliminate the `any` types in the decor layer; tighten `noUnusedLocals/Parameters`.
11. Reconsider the `no-store`/`Pragma` cache-busting metas for hosted deployments; add touch/keyboard parity + axe a11y tests for drag/drop and admin grids.
12. Add integration tests for the guest portal's full identify→auth→tab flow and for backend services once wired.

---

## 10. Recommended Roadmap (product framing)

- **Phase 1 (stability):** P0/P1 above — connect backend, fix auth hole, indexes, storage unification. Ship as a reliable single-workspace tool.
- **Phase 2 (multi-tenant platform):** organization + event + membership model wired to the real DB; server-side guest portal; real-time layout sync; vendor/timeline/staff data persisted per event.
- **Phase 3 (true "intelligence"):** the schema already hints at the data (guest counts, event statuses, vendor contract amounts, RSVP days, staff tasks). Surface **decision support** — e.g. capacity-vs-RSVP reconciliation, vendor payment tracking, timeline dependency checks, and layout-health scoring — powered by the now-real dataset.

---

## 11. Quick Stats (for the record)

| Metric | Value |
|---|---|
| App source lines (non-test) | ~41,567 |
| Test lines | ~6,446 |
| Test files | 64 (57 pass / 7 skipped) |
| Tests | 231 pass / 11 skipped |
| Typecheck | clean |
| Default bundle | ~1.2 MB (271 KB gzip), single-file |
| `any` usages | ~118 |
| Console statements | 17 |
| Unused deps | yjs, y-websocket |
| Unused backend modules | DatabaseService, EmailService, ObjectStorageService, AuthBackend (partial) |
| DB indexes | 0 |
| Git hygiene | clean; `.gitignore` correct; `node_modules` not tracked |

---

*End of review. This document was produced from a full read of the repository and a green run of its own CI commands. The findings are prioritized so you can act on the P0s immediately.*
