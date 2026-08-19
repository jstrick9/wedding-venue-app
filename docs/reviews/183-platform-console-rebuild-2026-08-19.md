# Review #183 — Platform Console rebuild (sidebar, venue edit, search)

**Repository:** `jstrick9/wedding-venue-intelligence-platform`  **Date:** 2026-08-19
**Scope:** Rebuild the platform admin portal from a single long page into a real
console with sidebar areas, venue search/filter, a post-create venue detail/edit
view, and a `update_venue_organization` RPC. Runtime code, SQL, and regression
tests were changed. Live Supabase RLS/RPC smoke tests remain pending.

User-selected IA (do not re-ask):

| Decision | Choice |
|---|---|
| Sidebar | Overview, Venues, Map, Onboard venue, Platform branding, Chat, **Audit** |
| Editable fields | Name, address, city/state/postal/country, primary contact, support email, phone, website, **status**. Slug stays immutable. Address changes re-geocode. |
| Edit UX | Directory row → full venue detail (identity/edit, metrics, admins, invites, suspend/reactivate, chat). Back returns to the filtered directory. |
| Search | Text across name, slug, city, state, country, contact email/phone; filters for status and region. |

---

## 1. What was fixed

| Item | Fix | Validation |
|---|---|---|
| **No post-create venue edit** | New security-definer RPC `update_venue_organization` (migration `0012`). Updates identity, address/contact, website, coordinates, and lifecycle status. Never writes `slug` (existing `prevent_organization_slug_change` trigger remains). Status `suspended`/`archived` sets suspend fields and revokes pending admin invites; `active`/`provisioning` clears them. Audit action `venue_updated`. | SQL reviewed; service tests cover RPC args, website sanitation, and failure mapping. Live RPC still needs a project. |
| **Single long console page** | `PlatformAdminPortal` is now a sidebar console. Hash routes stay inside the existing App mount (`#/platform-admin…`): overview, venues, venues/:id, map, onboard, branding, chat, audit. | New `platformConsoleRoute` tests + portal component tests. |
| **No search/filter** | Pure `filterPlatformVenues` / `listVenueRegions` helpers. Directory search + status + region selects. Filter state lives on the parent so Back from detail restores the filtered list. | Unit tests + portal directory test. |
| **Website XSS on save** | `updateVenueOrganization` runs `sanitizeHref` and **rejects** non-empty values that do not sanitize (e.g. `javascript:`). The detail form does the same before calling the service. | Service test. |
| **Audit area** | Console loads `platform_audit_logs` (RLS: `is_platform_support()`, which includes platform owner/admin) and renders When / Action / Venue / Reason. | Service mapping test + portal Audit screen test. |

**Still deferred (documented):**

- Phase 3 venue-intelligence features (booking/contract/deposit, space×time double-booking, inventory ledger, rotation-aware collision, day-of decision support).
- N-3 hash-only tokens in `couple_portal_snapshots.payload` — couple guest-management UI still needs the raw token after hydration.
- Remaining `@ts-nocheck` on 24 large admin/dashboard/couple components.
- 5 tests remain skipped (4 AdminPanel expand/collapse UI + App.smoke AuthenticatedApp shell).
- Live Supabase migration/RLS/Edge-Function smoke test (no project in this workspace). Apply **`0011` and `0012`** before claiming the console edit path is live.

---

## 2. Console information architecture (as shipped)

Hash scheme (handled inside the portal; App does not remount on sub-hashes):

| Hash | Area |
|---|---|
| `#/platform-admin` | Overview KPIs + awaiting-admin / suspended lists |
| `#/platform-admin/venues` | Searchable directory |
| `#/platform-admin/venues/<id>` | Detail + edit + lifecycle + chat |
| `#/platform-admin/map` | Existing point / density / region map |
| `#/platform-admin/onboard` | Create venue (geocode then `create_venue_organization_v2`) |
| `#/platform-admin/branding` | Platform login/console branding |
| `#/platform-admin/chat` | Per-venue platform↔venue thread picker |
| `#/platform-admin/audit` | Recent `platform_audit_logs` |

Address edits re-geocode through `geocode-venue`. If the address is unchanged, existing coordinates are kept. If the address changed and geocode fails, save is blocked.

---

## 3. Cloud honesty after this change

When `VITE_BACKEND_PROVIDER=supabase` is configured **and** migration `0012` is applied:

1. A platform admin can open a venue and persist identity/contact/location/status without recreating the tenant.
2. The slug shown in the detail header is the same slug returned by the RPC (`organization_slug` from the previous row) and is never sent as an update column.
3. Unsafe website values never reach Postgres.
4. Status transitions to suspended/archived revoke pending `venue_admin_invites` inside the same function.

This path is **not live-certified**. Apply migrations `0001`–`0012` and run a platform-admin edit + audit-row smoke test before claiming production readiness.

---

## 4. Validation

Re-run against HEAD after this change:

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 46 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **799 passed / 5 skipped** (was 784 / 5) |
| `npm run build` | Pass — 2,095.60 kB / 485.59 kB gzip |
| `VITE_SPLIT=1 npm run build` | Pass (no empty/circular chunk warnings) |
| `npm audit --omit=dev` | 0 vulnerabilities |

Live SQL/RLS: **not executed**.

New automated coverage:

- `src/utils/platformVenueFilters.test.ts`
- `src/utils/platformConsoleRoute.test.ts`
- `src/services/platform/platformAdminService.test.ts` (update + audit)
- `src/components/PlatformAdminPortal.test.tsx` (sidebar, search, detail, save without re-geocode, audit)

---

*End of Review #183.*
