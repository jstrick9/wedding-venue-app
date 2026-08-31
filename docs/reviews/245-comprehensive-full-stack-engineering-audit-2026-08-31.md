# Review #245 — Comprehensive Full-Stack Engineering Audit

**Repository:** `jstrick9/wedding-venue-intelligence-platform`
**Branch / baseline:** `main` at `8e4486d`  **Review date:** 2026-08-31
**Review type:** Fresh, independent, evidence-based audit (successor to Review #180's deep audit). Engineering-first scope per operator direction: security, multi-tenancy, data integrity, architecture, and code quality, with venue-domain fit as a secondary lens. All runtime findings carry `file:line` evidence verified against HEAD.
**Scope:** All 747 tracked files — `src/` runtime + tests, 15 Supabase migrations (4,762 lines SQL), 3 Edge Functions, CI workflows, docs. 112 commits / 259 files changed (+19,208 / −1,808 lines) since the #180 baseline (`5d682ff`) were reviewed as a delta; the full tree was re-verified where prior reviews made claims.

---

## 1. Executive summary and verdict

The platform is in materially better shape than at Review #180. Every P0 from the #173/#180 baselines is now **fixed in code** (verified at HEAD, not from notes): owner bootstrap, role mapping, guest-RPC hardening, cloud password reset, RBAC unification, backup secret redaction, org_data sensitive-domain write gating, server-derived chat `sender_side`, the couple→relational projection, and console-metrics accuracy. The #181–#244 remediation series (invite delivery, dual-session auth, path-based invite URLs, claim/reissue lifecycle, operator-first console actions, and the 30-instance "must not hang" campaign) shows a disciplined, evidence-driven loop, and the layout repository now has real optimistic-revision concurrency instead of destructive replace-sync.

**Current-state verdict (verified against HEAD):**

| Area | Assessment |
|---|---|
| Local / single-browser mode | **Strong.** Green gates, 973 passing tests, corruption-recovering versioned storage, typed event bus. |
| Supabase security model | **Sound design, static-only verification.** RLS layering (org → event → platform), security-definer RPC discipline, hashed invite tokens, server-derived trust decisions are all correct on paper. Still **never executed against a live project** — see §9. |
| Reliability engineering | **Symptom-patched, not root-caused.** The 30-review hang campaign added UI-layer timeouts one at a time while the **service layer still has ~50 bare awaits and no global fetch deadline**, and two 5-second polling loops can stack unbounded stalled requests. |
| Latent-crash risk | **Real.** 7 components call hooks after conditional early returns (`react-hooks/rules-of-hooks`); a live permission change can crash the workspace mid-session. |
| Guest data integrity | **One genuine race.** The anonymous couple-snapshot RSVP writer has a read-modify-write lost-update window with no row lock. |
| Bundle / type-safety budget | **Deteriorating trend.** 557 kB gzip single-file (+15% since #180), 752 kB admin chunk, and the entire venue-admin console (24 files, ~18.6 K lines) is still `@ts-nocheck`. |

**Most important message:** the next failure class for this platform is no longer "a screen hangs" (those are patched) — it is **"a stalled call stacks forever inside a poller"**, **"a permission change crashes a mounted component"**, and **"two concurrent guest RSVPs lose one submission"**. Those are the P1 items this review files, and the ones this review remediates.

---

## 2. Verification baseline (re-run against HEAD on 2026-08-31)

| Gate | Result | Notes |
|---|---|---|
| `npm ci` | Pass | — |
| `npm run typecheck` (`tsc --noEmit`) | **Pass**, 0 errors | — |
| `npm run lint:events` | **Pass** | No raw `spm_*` outside the typed bus. |
| `npm run lint` (ESLint) | **0 errors / 47 warnings** | 14 warnings are `react-hooks/rules-of-hooks` (see P1-B). |
| Strict unused-locals scan (non-test) | **Clean** | — |
| `npx vitest run` | **973 passed / 5 skipped** (978 total); 236 files passed / 4 skipped | Duration ~304 s. Skips: 4 AdminPanel UI expand/collapse tests + heavy App.smoke mount. |
| `npm run build` (single-file) | **Pass**; `dist/index.html` **2,331.80 kB / 556.74 kB gzip** | Up from 2,073/481 kB at #180 and 1,793/409 kB at #173. |
| `npm run build:split` | **Pass** | `chunk-admin` **751.57 kB (162.46 kB gzip)**; `guestPortal`/`ObjectStorageService` dynamic imports still defeated by static imports (build warnings persist); Leaflet 149.92 kB ships in the guest-portal chunk. |
| `npm audit --omit=dev` | **0 vulnerabilities** | — |
| Live Supabase migrations / RLS / Edge Functions | **Not executed in this review** | Static SQL analysis only. Live smoke checklist in §9; operator has a live project. |

**Repository shape (HEAD):** 747 tracked files; ~98 K lines in `src` (65.8 K components / 9.3 K services / 11.7 K utils); 459 TS/TSX files (435 runtime / tests split roughly evenly); 15 migrations; 3 Edge Functions; 244 prior review documents; **24 runtime files use `// @ts-nocheck`** (all in the venue-admin console); **124 `any`/`as any` occurrences** in runtime files outside those.

---

## 3. Status of the prior P0/P1 baseline (re-verified against HEAD, not from notes)

### Fixed and verified (evidence at HEAD)

| Prior item | Status | Evidence |
|---|---|---|
| P0-1 owner bootstrap | ✅ Fixed | `0001_initial.sql` `membership_bootstrap_owner` policy; `AuthBackend.signUpWithSupabase` throws on failed membership insert. |
| P0-2 cloud is not the data provider | ✅ Largely fixed | `coupleProjection.ts` + migration `0011` (`sync_couple_projection`, `source_*` ids, hashed guest tokens); console metrics count projection *or* raw payload (`GREATEST`). |
| P0-3 legacy guest RSVP RPC | ✅ Fixed | `0010` rewrites `submit_guest_rsvp` (portal enabled/window/deadline/event-status checks, field validation, no `sub::inet`); the `_for_venue` variants delegate to the same hardened base — both paths covered. |
| P0-4 owner→basic role mapping | ✅ Fixed | `AuthBackend.mapRole()` maps `owner`/`admin`→`admin`. |
| P0-5 password reset | ✅ Fixed | `PasswordRecoveryScreen` + `/reset/:surface` path routes + `completeSupabasePasswordRecovery` (PKCE code exchange on the matching surface client only); recovery never reuses an existing session (#220). |
| P1-1 org_data broad member RLS | ✅ Fixed | `0010` `org_data_write_allowed()` gates 8 sensitive domains to owner/admin. Domain list cross-checked against every key in `BACKUP_DOMAINS` — all sensitive keys (`config`, `rbacRoles`, `rbacGroups`, `rbacAudit`, `securitySettings`, `orgInvites`, `communicationTemplates`, `operationsSettings`) are covered; `users`/`coupleChatRead`/`savedLayouts` are `LOCAL_ONLY_DOMAINS`. |
| P1-2/P1-3 event-bus domain keys | ✅ Fixed | `DataChangedType` is a strict union; `eventDomainConsistency.test.ts` scrapes all emitters. |
| P1-4/P1-5 layout destructive replace-sync | ✅ Largely fixed | `layoutRepository.saveAll` now upserts by correlation with optimistic revision guard (stale local edits skipped, never clobbered) and appends `layout_versions`; `loadAll` returns `[]` faithfully. Residual nuance: "row absent locally ⇒ delete remotely" still means the last-saver wins for *deletions* across devices (acceptable, documented). |
| P1-6 skipped tests | ✅ Mostly fixed | 11 skips at #173 → 5 today (4 AdminPanel chrome tests + heavy smoke mount). |
| P1-7 RBAC unification | ✅ Fixed | One granular authority (`rbacDefaults` + `rbacBridge`); no admin/staff short-circuits. |
| P1-8 backup secrets | ✅ Fixed | `backupSecrets.ts` redaction + no-clobber restore semantics. |
| N-5 geocode rate slot | ✅ Fixed | `0010` `venue_geocode_rate` slot + Geoapify migration (`0014`). |
| N-6 client-chosen chat sender_side | ✅ Fixed | `0010` `set_platform_chat_sender_side` trigger derives the side server-side. |
| N-2 invite token URL hygiene | ✅ Fixed | Path-only `/i/<token>` URLs (#206), token persisted to sessionStorage (#204). |
| N-4 console metrics read zero | ✅ Fixed | Projection + `GREATEST` counting (`0011`); KPIs show **—** while pending (#219). |
| N-8 stale README | ✅ Fixed | README documents 0001–0015, the honesty boundary, and secret placement. |

### Still open (carried, unchanged)

| Prior item | Status |
|---|---|
| N-3 (180): raw guest/couple link tokens at rest inside `couple_portal_snapshots.payload` | Open by design — local-mode invite links must survive hydration (`0005` header comment). The public RPCs strip `token` on return (`guest_row - 'token'`) and match by `token` **or** `tokenHash`. Recommend a roadmap item to store only hashes once local mode stops needing raw tokens. |

---

## 4. New findings (this review)

Severity scale: **P0** = exploitable data breach / crash now · **P1** = likely production incident under realistic conditions · **P2** = real defect, bounded conditions · **P3** = hygiene.

### P1-A — Reliability: the service layer has no deadline discipline; polling loops can stack stalled requests indefinitely

The #214–#244 campaign (30 reviews) added `withTimeout` guards at the **component** layer (15 files). The **service layer still performs ~50 bare `await`s on Supabase calls**, and `createSurfaceClient` (`supabaseClient.ts:36-43`) builds clients with **no global fetch timeout or AbortSignal** — so every timed-out UI still leaves the underlying request alive and unattached.

Worst instances (verified):

- `src/components/GuestPortal.tsx:210` — `setInterval(() => void hydrateGuest(), 5000)`; `hydrateGuest` awaits `pullGuestPortalSnapshot` (`coupleCloudSync.ts:268`) with no timeout and **no in-flight guard**. A stalled network stacks a new anonymous RPC every 5 seconds, unbounded. The `cancelled` flag only suppresses state application, not the requests.
- `src/components/CouplesPortal.tsx:263` — identical pattern for `hydrateRemote` on the couple surface.
- Bare awaits with no caller-side timeout: `platformAdminService.ts` (12 sites), `platformChatService.ts:66,82`, `platformBrandingService.ts:20,27,34`, `publicVenueService.ts:14`, `coupleCloudSync.ts:136,156,166,176,186,236,268,299`, `guestPortalBackend.ts:86,124`, `entityRepository.ts:79,109`, `layoutRepository.ts:69,91,101,135,146,160`, `ObjectStorageService.ts:43,50`, `brandingAssetService.ts:12`, `inviteService.ts:74,119`, `EmailService.ts:76`.

**Root fix (implemented in this review):** a global fetch wrapper with a hard deadline in `createSurfaceClient`, plus in-flight guards in the two pollers. This makes the one-off `withTimeout` patches unnecessary for any future service call.

### P1-B — Latent crash: 7 components call hooks after conditional early returns

ESLint reports 14 `react-hooks/rules-of-hooks` violations (currently warnings). `StaffOperationsPanel.tsx:60-78` returns an "Access denied" dialog **before** 14 `useState` + `useEffect` + `useMemo` + `useCallback` calls (lines 81-314). The same pattern exists in `DecorDesigner`, `DrawingTool`, `EventQuestionsWizard`, `GuestPortal`, `LodgingBuilder`, `PlatformVenueMap`.

If the guard condition flips while the component is mounted — exactly what the #118 collaborator-role-change and #160/#161 staff-RBAC workflows do (permission revoked while the panel is open) — React throws *"Rendered fewer hooks than expected"* and the workspace unmounts to the error boundary. This is a crash, not a styling issue; the severity is P1 because role changes are a supported live workflow.

**Fix (implemented in this review):** hoist all hooks above the access guard in each affected component (guard becomes a render-time branch after the hook block).

### P1-C — Data integrity: anonymous couple-snapshot RSVP writer has a lost-update race

`submit_guest_couple_rsvp` (`0010`, and the `_for_venue` variant by delegation) does:

1. `select * into snapshot_row from couple_portal_snapshots where couple_id = p_couple_id;` — **no `for update`**
2. computes `next_rsvps` from the payload it just read (excluding the submitting guest)
3. `update ... set payload = jsonb_set(payload, '{coupleSubmissions}', next_rsvps)`

Two guests submitting concurrently (the RSVP-deadline crush — a wedding's most realistic concurrency spike) each compute their own array from the same base payload; the second write silently discards the first submission. The same class applies to a couple-device `save_couple_portal_snapshot` full-payload replace clobbering a guest RSVP written between the couple's read and write.

**Fix (implemented in this review):** `select ... for update` row lock in the guest submit path (new migration `0016`), which serializes submitters on the snapshot row.

### P1-D — Performance/DoS: `guests.portal_token_hash` has no index; anon RPCs seq-scan the guests table

`0001_initial.sql:150` defines the column; **no migration ever indexes it** (contrast: `venue_admin_invites.token_hash` is `unique`, hence indexed; `couple_portal_snapshots.couple_token_hash` is `unique`). The anon-accessible `submit_guest_rsvp()` (`0010:52`) and `get_guest_by_portal_token()` (`0002:37`) filter on it inside `security definer` functions — RLS is bypassed, so **every anonymous call scans every organization's guests**. Latency grows linearly with platform-wide guest count, and an unauthenticated caller gets a cheap amplification vector. The `0011` projection upsert also joins on `portal_token_hash` when reconciling.

**Fix (implemented in this review):** `create index ... on public.guests (portal_token_hash)` in migration `0016`.

### P2-E — Security: the public `public-branding` bucket accepts `image/svg+xml`

`0009:247-249` creates the bucket **public-read** with `allowed_mime_types` including `image/svg+xml`; `uploadPublicBrandingAsset` (`brandingAssetService.ts`) trusts the client-supplied `file.type`. SVG executes script when opened directly from the storage origin. Today that origin (`<project>.supabase.co`) is distinct from the app origin, so impact is content-injection/phishing on a trusted domain rather than app-origin XSS — but it becomes full stored XSS the day the app is served from (or shares cookies with) that domain, and Supabase storage serves SVG inline by default.

**Fix (implemented in this review):** migration `0016` drops SVG from the bucket's allowed MIME types. PNG/JPEG/WebP/GIF cover every branding use case.

### P2-F — Data integrity: cloud sync failures are silent (fire-and-forget)

`AuthenticatedApp.tsx:446,449,795,832,846` invoke `void entityBackendSync.saveToBackend()` / `void layoutBackendSync.saveToBackend()`; failures inside `useEntityBackendSync` are `console.error` only. This violates the platform's own §9.4 rule ("never silently fall back to local persistence after a cloud write error") — a venue admin edits the catalog, sees success, and the change never reaches the cloud. There is no user-visible failure signal and no retry affordance.

**Fix (implemented in this review):** failed pushes now emit a typed event surfaced as a warning toast (same channel as `spm_storage_error`), with the domain named.

### P2-G — Trust/ops: `claim-venue-admin` is non-atomic and unthrottled

1. The Edge Function sets/creates the Auth password, but the invite stays `pending` until the *client* subsequently calls `accept_venue_admin_invite`. A user who abandons the tab after the password step leaves a live pending invite whose token can reset that password again.
2. No per-token/per-IP rate limit on claim attempts (16+ char tokens make brute force infeasible, but unbounded attempts are still free).
3. All three Edge Functions reflect any `Origin` in CORS (`geocode-venue/index.ts:13-20`, `send-email`, `claim-venue-admin`). This is documented as deliberate (error visibility) and is low-risk while auth is bearer-token-in-header; it becomes P0 if cookie auth is ever introduced. README/.env.example still imply `ALLOWED_ORIGIN` is enforced.

**Recommendation (not remediated this review — needs a coordinated Edge Function + RPC change):** fold invite consumption into a single service-role transaction (password set + status flip together) or have the claim RPC flip the invite inside the same transaction as membership transfer, and add a simple attempt counter per token hash.

### P2-H — Bundle health: no budget gate; growth is accelerating

Single-file: 409 kB (#173) → 481 kB (#180) → **557 kB gzip (HEAD)** — +15% in 10 days of reviews. Split build: `chunk-admin` **752 kB**; `guestPortal` and `ObjectStorageService` are `import()`-ed but also statically imported elsewhere so the split is defeated (build warnings persist since #180); Leaflet (150 kB) ships with the guest-portal chunk. Nothing in CI fails on size. **Recommendation:** add a CI budget (e.g., single-file ≤ 600 kB gzip, chunk-admin ≤ 800 kB raw) and fix the two static/dynamic import conflicts.

### P2-I — Type safety: the admin console remains untyped with no ratchet

24 `@ts-nocheck` files — the entire venue-admin surface (`UserManagement` 1,825 lines, `BrandingManagement` 1,716, `AdminPanel` 1,693, …) — plus 124 `any`/`as any` elsewhere. The green `tsc` gate covers none of the console that writes `org_data`. **Recommendation:** a CI ratchet (fail if the count grows; ratchet down over time) and re-typing smallest-first (`AdminSharedComponents`, `SpacingManagement`, `LinenManagement`).

### P1-K — CI has been failing on every clean commit: the unused-locals gate was inverted (found during this review's push; fixed in `14ca5bc`)

The `Strict unused-locals scan (non-test)` step in `.github/workflows/ci.yml` ran:

```
npx tsc --noEmit --noUnusedLocals 2>&1 | grep -v "\.test\." | grep -v "node_modules"
```

When `tsc` is **clean** it prints nothing, the `grep -v` pipeline matches no lines and **exits 1**, which GitHub Actions treats as step failure. The gate was therefore inverted: it failed on every healthy commit and "passed" only when unused-local violations actually existed. Verified via the GitHub API: **39 of the last 40 CI runs failed on this step**, and the single green run (74abb2d) was green because violations were printed. Consequence: the entire #181–#244 remediation series shipped with a permanently red CI — every "record CI gate results" doc recorded *local* gates while the real workflow never went green, so CI provided zero regression protection. **Fixed in this review** (`14ca5bc`): the step now fails only when real violations are printed.

### P3-J — Minor / hygiene

1. **`submit_guest_rsvp` has no per-call rate limit** — validation is good, but an anon caller can submit unbounded replacements for a valid token (idempotent-by-replace, so impact is bounded; a `venue_geocode_rate`-style slot or audit-log limiter like `send-email`'s would close it).
2. **5 skipped tests** (4 AdminPanel chrome + heavy smoke mount) — known/documented.
3. **`act(...)` warnings** in CouplesPortal/AuthContext/AdminPanel test files — noisy logs, no failures; batch with `userEvent` setup.
4. **Docs drift**: `AI_AGENT_MEMORY.md` §2.2 describes a 5-gate protocol while CI actually runs 7 gates (better than documented — update the memory doc, as this review does).
5. **`findAuthUserIdByEmail` fallback** (`claim-venue-admin`) lists up to 2,000 users in 10 pages when `getUserByEmail` is unavailable — fine today, brittle at platform scale.

---

## 5. Architecture assessment (engineering-first)

**What is genuinely well-designed (preserve):**

- **Dual-surface session model** (`wvip-auth-platform` / `wvip-auth-venue`): separate storage keys, separate clients, surface switching driven by route detection, local-scope sign-out on rejected logins (#218), and a one-way legacy migration that never duplicates a refresh token. This is a careful, correct answer to "platform operator and venue staff in one browser."
- **RLS layering**: org membership → org role → event membership, with platform roles orthogonal; `security definer` RPCs that re-check `auth.uid()`/role before mutating; wrapper+`_unchecked` RPC pattern that adds venue-status gating without duplicating validation; server-side derivation of trust decisions (chat side, org_data domain gating, invite email binding).
- **Storage policy path conventions** (`<org-id>/…`, `venues/<org-id>/…`, `platform/…`) with role checks parsed from the path; filename sanitization in `ObjectStorageService`.
- **Versioned storage envelopes + corruption recovery + typed event bus** remain the strongest local-mode primitives in the codebase.
- **Edge Function auth**: `send-email` and `geocode-venue` verify the JWT server-side (`auth.getUser`) and re-check membership/role server-side; `send-email` adds per-user/org rate limiting via audit logs. The service-key-with-user-Authorization-header client pattern correctly subjects role checks to RLS.

**Where the architecture is strained:**

1. **The timeout architecture is inverted.** Deadlines belong at the transport (one global fetch wrapper), not painted onto individual buttons after production incidents. 30 reviews of UI patches is the symptom; `createSurfaceClient` never passing a `fetch` with an abort deadline is the cause.
2. **`org_data` as a single JSON-blob table per domain** is pragmatic but caps the "Intelligence" story: metrics do `jsonb_array_length` over whole-domain payloads, the sensitive-domain gate is a string list that must be manually kept in sync with `BACKUP_DOMAINS`, and every domain write is a full-payload replace. It works at 10 venues; plan the relational split per domain before ~100.
3. **Guest/couple data has two sources of truth** (relational projection `0011` vs snapshot JSONB) reconciled by `sync_couple_projection` at push time. The projection fixed the metrics problem, but the snapshot remains the serving path for portals — so P1-C's race lives in the snapshot layer the projection mirrors.

---

## 6. Code quality & testing

- **Test suite scale/health:** 978 tests (973 passing), 240 files; service-layer tests mock the Supabase client and assert SQL-adjacent behavior; the platform console now has real coverage (`PlatformAdminPortal.test.tsx`, `platformAdminService.test.ts`, `platformGeocodingAndChat.test.ts`, `inviteService.supabase.test.ts`) — closing #180's "zero console coverage" gap. Hang-regression tests (`*.hang.test.ts`) accompany each timeout fix — good pattern.
- **The two structural debts** remain: `@ts-nocheck` admin console (P2-I) and `any` usage (124). Neither has a ratchet.
- **ESLint:** 0 errors / 47 warnings, but 14 of those warnings are crash-class (P1-B). Recommend promoting `react-hooks/rules-of-hooks` to `error` in `eslint.config.js` once P1-B is fixed so it can never regress silently.
- **CI:** 7 gates including split build and prod dependency audit — stronger than the documented protocol; add the bundle budget (P2-H) and, ideally, an SQL lint pass (e.g., `squawk`) for future migrations.

---

## 7. Wedding-venue domain notes (secondary lens, per operator direction)

Engineering-first scope, so the domain verdict is recorded briefly: the #180 §5 domain gaps remain **by design and accurately labeled** (no booking/deposit/revenue lifecycle; BEO is a print artifact, not a versioned, sign-off-controlled record; catering counts still lack a single authoritative projection; collision math still axis-aligned despite `rotation` in the data model; vendor persona is a curated directory, not self-service). The honesty boundary in the README is correct and should stay. Two domain-adjacent items from this review are worth operator attention:

1. **P1-C is a wedding-day problem, not just an engineering problem** — RSVP deadlines concentrate submissions in the final 72 hours; that is precisely when the lost-update race is most likely to fire.
2. **The console's venue metrics measure activity, not business health.** For a venue operator, "utilization / deposits collected / leads lost" is the KPI layer that would justify "Intelligence Platform" — deferred deliberately, but it is the natural Phase 3 after backend trust is certified live.

---

## 8. What this review remediates (follow-up commit)

All P1s and two P2s are fixed in the companion commit `fix(platform): Review #245 — …`:

| Finding | Fix | Validation |
|---|---|---|
| P1-A | Global 30 s abort deadline on every Supabase fetch (`createSurfaceClient` now passes a `fetch` wrapper built on a manual `AbortController`+timer, portable across browsers and jsdom; `VITE_SUPABASE_FETCH_DEADLINE_MS` override); in-flight guards in the GuestPortal and CouplesPortal 5 s pollers (a stalled tick skips instead of stacking) | New `supabaseFetch.test.ts` (4 tests: pass-through with headers intact, deadline abort, caller-signal abort, pre-aborted signal); new `PortalPolling.singleFlight.test.ts` (4 guard assertions) |
| P1-B | Hooks hoisted above the access guard in `StaffOperationsPanel` (the only file with actual `rules-of-hooks` violations; the other six names from the eslint context grep were false positives) | New permission-revoked-while-mounted regression test (old code threw "Rendered fewer hooks"); `react-hooks/rules-of-hooks` warnings: **14 → 0** |
| P1-C | Migration `0016`: `select … for update` row lock in `submit_guest_couple_rsvp` (both base and `_for_venue` delegate) | Static SQL review; live verification script in §9 |
| P1-D | Migration `0016`: `create index … on public.guests (portal_token_hash)` | Live verification script in §9 |
| P2-E | Migration `0016`: `public-branding` bucket no longer accepts `image/svg+xml` | Live verification script in §9 |
| P2-F | Failed entity/layout pushes now emit a typed `spm_cloud_sync_error` event surfaced as a warning toast (domain named) via `GlobalCloudSyncErrorListener` | New `appEvents.test.ts` cases (2) + `PortalPolling.singleFlight.test.ts` assertions |

**Re-run CI gate results after remediation (commit-time):**

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | **0 errors / 30 warnings** (was 0/47) |
| Strict unused-locals scan | Clean |
| `npx vitest run` | **984 passed / 5 skipped** (989 total; 238 files passed / 4 skipped) |
| `npm run build` | Pass — **2,332.51 kB / 556.94 kB gzip** (+0.2 kB for the reliability layer) |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

Not remediated (filed with recommendations): P2-G (claim atomicity + throttle), P2-H (bundle budget CI gate), P2-I (`@ts-nocheck` ratchet), P3-J items. These need operator decisions on Edge Function redeploy cadence and CI policy; all are scoped for a follow-up review.

---

## 9. Live verification checklist (run against the operator's live project)

Static analysis found the design sound; **the platform has still never had its RLS/RPC layer executed against a live database.** With the operator's live project, run this in order (SQL Editor or `supabase db psql`), after applying migrations 0001–0016:

```sql
-- 1. Migration state: expect exactly 0001..0016, each once.
select version, name from supabase_migrations.schema_migrations order by version;

-- 2. P1-D: index exists and is used.
explain analyze
select * from public.guests where portal_token_hash = 'deadbeef'::text;
-- Expect: Index Scan using idx_guests_portal_token_hash (not Seq Scan).

-- 3. P2-E: bucket MIME list no longer contains svg.
select allowed_mime_types from storage.buckets where id = 'public-branding';

-- 4. Tenant isolation probe (as anon, via REST is fine):
--    curl -s "$URL/rest/v1/org_data?select=*" -H "apikey: $ANON" → must be []
select count(*) from public.org_data;              -- as anon via RPC is blocked; use a venue JWT session to confirm only own-org rows.

-- 5. Platform-role probe: sign in as a venue-only admin and call
--    get_platform_console_metrics() → expect {"ok":false,"error":"forbidden"}.

-- 6. Suspended-venue probe: suspend a test venue, then hit
--    get_public_venue_branding('<slug>') → expect venue_unavailable, and venue login must fail.

-- 7. P1-C lock probe (two sessions): open two SQL sessions; in A run
--    begin; select payload from public.couple_portal_snapshots where couple_id='<id>' for update;
--    in B call submit_guest_couple_rsvp('<id>','<token>','{"attending":true}'::jsonb);
--    expect B to block until A commits (lock held) — then verify B's submission includes A-era submissions.
```

Plus the Edge Function checks: `claim-venue-admin` rejects an 8-char token, a revoked token, and a suspended venue; `geocode-venue` rejects a non-platform JWT with 403; `send-email` rate-limits at 100/hour/user/org.

---

*End of Review #245.*
