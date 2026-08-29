# Venue Portal — Comprehensive UX/Product Review

*Acting as a wedding-venue product/UX expert. Grounded in research on leading
venue-management platforms (Tripleseat, Perfect Venue, Planning Pod, AllSeated,
Event Temple, Aisle Planner, WeddingWire, Zola) and a deep review of the current
codebase. Items are prioritized (P0 = high impact / directly requested,
P1 = valuable, P2 = polish).*

## Status
- ✅ **Signed-in venue login before branding (#235, 2026-08-29)** — a matching venue session shows Open Venue Workspace immediately instead of waiting on public branding. Full report: **`docs/reviews/235-signed-in-venue-login-before-branding-2026-08-29.md`**.
- ✅ **Session restore timeout (#234, 2026-08-29)** — cloud boot restore times out at 20s instead of leaving venue/platform login on Loading…; init always finishes. Full report: **`docs/reviews/234-session-restore-timeout-2026-08-29.md`**.
- ✅ **Venue login branding timeout (#233, 2026-08-29)** — `#/venue-login/<slug>` times out public branding at 20s instead of staying on Loading venue sign-in; Try again is offered. Full report: **`docs/reviews/233-venue-login-branding-timeout-2026-08-29.md`**.
- ✅ **Platform support must not open workspace (#232, 2026-08-29)** — `platform_support` on `#/platform-login` is denied with Sign out instead of dumping into the venue workspace; local-mode is unchanged. Full report: **`docs/reviews/232-platform-support-must-not-open-workspace-2026-08-29.md`**.
- ✅ **Branding save timeout (#231, 2026-08-28)** — Save Platform Branding and logo upload time out at 20s instead of staying on Saving…. Full report: **`docs/reviews/231-branding-save-timeout-2026-08-28.md`**.
- ✅ **Chat prefers live venue (#230, 2026-08-28)** — Chat tab no longer auto-selects an archived/suspended first row; active then provisioning is the default thread. Full report: **`docs/reviews/230-chat-prefer-live-venue-2026-08-28.md`**.
- ✅ **Platform chat timeout (#229, 2026-08-28)** — Chat list and send time out at 20s instead of staying on Loading chat… / Sending…. Full report: **`docs/reviews/229-platform-chat-timeout-2026-08-28.md`**.
- ✅ **Invite/lifecycle timeout (#228, 2026-08-28)** — reissue, revoke, suspend, and invite email send time out at 20s instead of leaving the operator on a disabled button. Full report: **`docs/reviews/228-invite-lifecycle-timeout-2026-08-28.md`**.
- ✅ **Staff login/reset timeout (#227, 2026-08-28)** — Sign In, forgot-password send, and recovery save time out at 20s instead of staying on Signing in…. Full report: **`docs/reviews/227-login-and-reset-timeout-2026-08-28.md`**.
- ✅ **Invite preview scoped to venue (#226, 2026-08-28)** — onboard/reissue HTML preview no longer follows the operator onto another venue’s detail. Full report: **`docs/reviews/226-invite-preview-scoped-to-venue-2026-08-28.md`**.
- ✅ **Archived venues restorable (#225, 2026-08-28)** — archived venue detail has Restore venue (existing reactivate RPC). Full report: **`docs/reviews/225-archived-venues-restorable-2026-08-28.md`**.
- ✅ **Invite lookup/claim timeout (#224, 2026-08-28)** — `/i/<token>` shows the claim form without waiting on venue branding; lookup 20s / claim 30s timeouts. Full report: **`docs/reviews/224-invite-lookup-claim-timeout-2026-08-28.md`**.
- ✅ **Console venue list timeout + pending KPIs (#223, 2026-08-28)** — first paint no longer waits on the organization list before metrics; list-derived KPIs show — until venues load; list times out at 20s. Full report: **`docs/reviews/223-console-venue-list-timeout-pending-kpis-2026-08-28.md`**.
- ✅ **Onboard geocode/create timeout (#222, 2026-08-28)** — Create Venue no longer hangs forever if Geoapify or the create RPC stalls. Full report: **`docs/reviews/222-onboard-geocode-create-timeout-2026-08-28.md`**.
- ✅ **Provisioning venue login allowed (#221, 2026-08-28)** — claimed admins can sign in before Activate; Suspend/Archive still block. Full report: **`docs/reviews/221-provisioning-venue-login-allowed-2026-08-28.md`**.
- ✅ **Recovery must not use existing session (#220, 2026-08-28)** — `/reset/…` without a recovery code cannot change the signed-in account’s password. Full report: **`docs/reviews/220-recovery-must-not-use-existing-session-2026-08-28.md`**.
- ✅ **Console KPIs pending not zero (#219, 2026-08-28)** — Couples/Guests/RSVPs show — until metrics return; Managed admins come from the venue list. Full report: **`docs/reviews/219-console-kpis-pending-not-zero-2026-08-28.md`**.
- ✅ **Failed login must not leave a stray JWT (#218, 2026-08-28)** — valid password at the wrong venue/platform door locally signs out that surface only and resyncs React. Full report: **`docs/reviews/218-failed-login-must-not-leave-stray-jwt-2026-08-28.md`**.
- ✅ **Path-only password reset (#217, 2026-08-27)** — Forgot password emails `/reset/platform` or `/reset/venue`; recovery exchanges the code on the matching dual-session client. Full report: **`docs/reviews/217-password-reset-path-and-recovery-session-2026-08-27.md`**.
- ✅ **Signed-in platform login returns to console (#216, 2026-08-27)** — after sign-out, `#/platform-login` plus a platform administrator session opens the console instead of the venue workspace. Full report: **`docs/reviews/216-platform-login-returns-to-console-2026-08-27.md`**.
- ✅ **Venue Platform Chat uses venue session (#215, 2026-08-27)** — venue Admin Platform Chat was using the platform JWT; list/send now use `wvip-auth-venue`. Full report: **`docs/reviews/215-venue-platform-chat-uses-venue-session-2026-08-27.md`**.
- ✅ **Console first paint vs metrics hang (#214, 2026-08-27)** — opening the console and Refresh no longer wait on `get_platform_console_metrics`; the venue list paints first. Full report: **`docs/reviews/214-console-first-paint-metrics-hang-2026-08-27.md`**.
- ✅ **Operator-first Platform console actions (#213, 2026-08-25)** — reissue/suspend/onboard no longer wait on metrics; KPI cards deep-link into filtered directory queues (including pending/expired invites); status is a read-only badge with Activate/Suspend/Reactivate/Archive buttons; map Open / edit opens venue detail; audit shows actor. Full report: **`docs/reviews/213-operator-first-platform-console-actions-2026-08-25.md`**.
- ✅ **Venue edit Save hang (#212, 2026-08-24)** — provisioning → active left Save stuck on Saving… because the button waited for console metrics; save now finishes on the update RPC. Full report: **`docs/reviews/212-venue-edit-save-hang-2026-08-24.md`**.
- ✅ **Venue-only claim page + reissue password (#211, 2026-08-24)** — setup heading is Claim {venue}'s Venue Workspace; platform info box, existing-account sign-in, and return-to-platform links are gone; reissue sets a new password without deleting venue work. Full report: **`docs/reviews/211-venue-claim-page-and-reissue-password-2026-08-24.md`**.
- ✅ **Platform reissue uses platform session (#210, 2026-08-24)** — Reissue & email invite was `forbidden` because the venue JWT hit the RPC; console mutations now require the platform login. Full report: **`docs/reviews/210-platform-reissue-uses-platform-session-2026-08-24.md`**.
- ✅ **Separate platform and venue sessions (#209, 2026-08-24)** — platform console and venue workspace keep independent logins; a venue invite no longer asks the platform admin to sign out. Full report: **`docs/reviews/209-separate-platform-and-venue-sessions-2026-08-24.md`**.
- ✅ **Renumber invite-lookup migration to 0015 (#208, 2026-08-24)** — unused Graph Outlook `0015` removed; claimed-venue reissue / invite lookup SQL is now **`supabase/migrations/0015_reissue_claimed_venue_and_invite_lookup.sql`**. There is no 0016. Full report: **`docs/reviews/208-renumber-invite-lookup-migration-2026-08-24.md`**.
- ✅ **Claimed-venue reissue + invite lookup SQL (#207, 2026-08-24)** — `SELECT vai INTO row` crashed lookup with a uuid syntax error; reissue/accept now work when the venue already has an owner. Apply the SQL as **`0015_reissue_claimed_venue_and_invite_lookup.sql`** (#208). Full report: **`docs/reviews/207-claimed-venue-reissue-and-invite-lookup-2026-08-24.md`**.
- ✅ **Path-only invite URL (#206, 2026-08-24)** — emailed setup links are `https://app/i/<token>` so Outlook/Brevo cannot strip the token. Full report: **`docs/reviews/206-path-invite-url-2026-08-24.md`**.
- ✅ **Brevo Outlook sender (#205, 2026-08-24)** — leftover `EMAIL_FROM=invites@weddingvip.com` no longer overrides the from-address; invites always send as `wedding-vip@outlook.com`. Full report: **`docs/reviews/205-brevo-outlook-sender-2026-08-24.md`**.
- ✅ **Brevo auto-send + invite TTL + token fix (#204, 2026-08-22)** — setup links no longer go invalid after the URL is cleaned; new vs reissue lifetimes are configurable; merge tags drag into the template; preview matches the live HTML email; onboard/reissue send via Brevo. Full report: **`docs/reviews/204-brevo-invite-ttl-and-token-fix-2026-08-22.md`**.
- ✅ **Manual HTML Outlook invite (#203, 2026-08-22)** — removed Azure/Graph/SMTP auto-send. Send with Outlook downloads a ready-to-send HTML `.eml` with a Set up your account button. Full report: **`docs/reviews/203-manual-html-outlook-invite-2026-08-22.md`**.
- ✅ **Outlook Graph connect (#202, 2026-08-22)** — SMTP 465 timed out on Edge; invites now send via Microsoft Graph after Platform Console → Email → Connect Outlook. Migration `0015`. Full report: **`docs/reviews/202-outlook-graph-connect-2026-08-22.md`**.
- ✅ **Outlook SMTPS port 465 (#201, 2026-08-22)** — “Failed to send a request to the Edge Function” was a hung connect to blocked port 587. send-email now uses Outlook SMTPS on 465 with timeouts and always returns CORS JSON. Full report: **`docs/reviews/201-outlook-smtps-port-465-2026-08-22.md`**.
- ✅ **Automatic Outlook SMTP + HTML invite (#200, 2026-08-22)** — fixed `DEFAULT_SMTP_USER` crash so invites send unattended; HTML “Set up your account” button; `Hello {first} {last},`; no auto-open Outlook; compose no longer shows `+` for spaces. Full report: **`docs/reviews/200-outlook-smtp-html-invite-2026-08-22.md`**.
- ✅ **Outlook invite delivery (#199, 2026-08-21)** — unattended send from `wedding-vip@outlook.com` (Outlook SMTP) plus one-click Outlook compose / mailto when email is not configured. Full report: **`docs/reviews/199-outlook-invite-delivery-2026-08-21.md`**.
- ✅ **Venue Home URL + Admin sidebar chrome (#198, 2026-08-20)** — workspace hash is `#/home` (leftover `#/dashboard`/`#/venue` rewrite); Admin and Design Studio return with `← Home`; Admin rail matches Home branding and mouse-hold resize while keeping #197 dropdown groups. Full report: **`docs/reviews/198-venue-home-hash-and-admin-sidebar-chrome-2026-08-20.md`**.
- ✅ **Admin sidebar branding, collapse, and section dropdowns (#197, 2026-08-20)** — dark rail uses venue primary color; ◀/▶ icon collapse; five groups start collapsed with hover descriptions. Full report: **`docs/reviews/197-admin-sidebar-brand-collapse-dropdowns-2026-08-20.md`**.
- ✅ **Venue dashboard Menu overlay + Admin sidebar console (#196, 2026-08-20)** — removed the landing-page hamburger that covered the sidebar on partial windows; Admin & System Settings is now a grouped left-sidebar console with Overview KPIs and `#/admin/…` section hashes. Full report: **`docs/reviews/196-venue-admin-sidebar-and-dashboard-menu-2026-08-20.md`**.
- ✅ **Staff login “or” divider + branded tabs (#195, 2026-08-20)** — hide the unused or divider on platform/venue login; sign-out of the console returns to `#/platform-login`; browser tab title/favicon follow platform or venue branding. Full report: **`docs/reviews/195-login-or-divider-and-tab-branding-2026-08-20.md`**.
- ✅ **Venue admin invite email (#194, 2026-08-20)** — onboard/reissue send Resend email; Branding customizes subject/body with merge tags. Full report: **`docs/reviews/194-venue-admin-invite-email-2026-08-20.md`**.
- ✅ **Platform chat load error (#193, 2026-08-20)** — Chat queried an empty UUID then kept a stale generic error. Skip empty org, surface Postgrest messages, auto-select first venue. Full report: **`docs/reviews/193-platform-chat-load-error-2026-08-20.md`**.
- ✅ **Platform map NaN LatLng (#192, 2026-08-20)** — Leaflet `(NaN, NaN)` on the network map: strict coordinate parse, explicit map height, wait for container size. Full report: **`docs/reviews/192-platform-map-nan-latlng-2026-08-20.md`**.
- ✅ **send-email bundle apostrophe (#191, 2026-08-20)** — `'You're invited'` broke `--use-api` deploy; quote fixed; functions deploy separately.
- ✅ **Accept sbp_ account tokens (#190, 2026-08-20)** — Account Access Tokens start with `sbp_`; the Action wrongly rejected them as project keys.
- ✅ **Deploy preflight too strict (#189, 2026-08-20)** — removed `GET /v1/projects/{ref}` (needs `project_admin_read`, blocked deploy). Action deploys directly. Full report: **`docs/reviews/189-deploy-preflight-too-strict-2026-08-20.md`**.
- ✅ **Deploy Action 403 vs Node 20 (#188, 2026-08-20)** — Node 20 line is a warning; live failure was Management API 403. Workflow uses Node 24 actions + token/project preflight. Full report: **`docs/reviews/188-edge-function-deploy-403-2026-08-20.md`**.
- ✅ **GitHub Edge Function deploy (#187, 2026-08-19)** — `Deploy Edge Functions` Action uploads `geocode-venue` / `send-email` from `main` (or Run workflow). Operator sets `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_ID` in GitHub secrets (browser). Full report: **`docs/reviews/187-github-edge-function-deploy-2026-08-19.md`**.
- ✅ **Live geocode unblock (#186, 2026-08-19)** — clearer “deploy geocode-venue + set GEOAPIFY_API_KEY” error instead of raw Failed to fetch; Edge Function CORS reflects Origin; click-by-click secret/deploy steps. Full report: **`docs/reviews/186-geocode-venue-live-unblock-2026-08-19.md`**.
- ✅ **Geoapify address quality + contact validation (#185, 2026-08-19)** — Nominatim replaced by Geoapify autocomplete/verify/tiles (server proxy, key never in the browser); city/state/ZIP fill from a verified US street; shared US phone/email/website checks. Migration `0014`. Full suite: **820 passed / 5 skipped**. Full report: **`docs/reviews/185-geoapify-address-quality-2026-08-19.md`**. AI-agent memory §9.16 updated.
- ✅ **Login screens tied to branding (#184, 2026-08-19)** — staff auth chrome uses branding; new venues default to charcoal/white/gray until they save branding; platform login stays navy; semantic status colors kept. Migration `0013`. Full suite: **807 passed / 5 skipped**. Full report: **`docs/reviews/184-login-branding-2026-08-19.md`**. AI-agent memory §9.15 updated.
- ✅ **Platform console rebuild (#183, 2026-08-19)** — sidebar console (Overview, Venues, Map, Onboard, Branding, Chat, Audit); searchable/filterable venue directory; post-create venue detail/edit (identity, address, contact, website, status; slug immutable; address changes re-geocode); `update_venue_organization` RPC in migration `0012`; audit log view. Full suite: **799 passed / 5 skipped**. Full report: **`docs/reviews/183-platform-console-rebuild-2026-08-19.md`**. AI-agent memory §9.14 updated.
- ✅ **Deferred P0/P1 items (#182, 2026-08-19)** — couple→org_data/relational projection (`0011` + `coupleProjection.ts`) so console metrics and the legacy guest RPC can see couple activity; RBAC unification (one authority, no admin/staff short-circuit when assigned roles exist, cycle-safe inheritance, registered permission ids); invite-acceptance `refreshSession()`; file-picker a11y + `sanitizeHref`; re-enabled collision / password-reset / assignment / seating tests. Phase 3, N-3 hash-only snapshot tokens, remaining `@ts-nocheck`, and live RLS smoke tests stay deferred. Full report: **`docs/reviews/182-deferred-p0-p1-2026-08-19.md`**. AI-agent memory §9.13 updated.
- ✅ **P0/P1 security & data-integrity remediation (#181, 2026-08-19)** — executed the Review #180 roadmap: backup secrets redaction (P1-8), strict typed event-bus domain keys (P1-3), per-domain pull hydration (P1-2), layout optimistic upserts (P1-4), empty-pull/retry/reset (P1-5), onboarding token URL strip (N-2), cloud password reset (P0-5), `org_data` RLS gating + guest RSVP RPC hardening + chat sender-side derive + geocode rate slot (new migration `0010`), and the first platform-console unit tests (N-1/N-7). Added ESLint + expanded CI + fixed the split-build chunk warnings + updated README/.env. Full suite: **760 passed / 11 skipped**. Full report: **`docs/reviews/181-remediation-2026-08-19.md`**. AI-agent memory §9.12 updated.
- ✅ **Deep full-stack & wedding-venue domain audit (#180, 2026-08-19)** — independent, evidence-based review of all 576 tracked files against HEAD `5d682ff`. Re-ran every CI gate (typecheck, event-bus lint, `vitest run` = **738 passed / 11 skipped**, single-file build = **2,073.67 kB / 481.45 kB gzip**, `build:split` now green) and reviewed the platform-console layer (#176–#179) as shipped code for the first time. Confirmed P0-1 (owner bootstrap) and P0-4 (owner→admin role mapping) are fixed; re-verified P0-2/3/5 and P1-1/2/3/4/5/7/8/9/11 remain open. New findings: the entire #176–#179 platform console ships with **zero automated tests**; onboarding invite token stays in the URL; raw bearer tokens stored in `couple_portal_snapshots.payload`; console couple/guest/rsvp metrics read from local-only `org_data` domains (will read 0); geocode Edge Function has no rate-limit/throttle; chat trusts client-supplied `sender_side`; CI is lighter than the documented 5-gate protocol. Full report: **`docs/reviews/180-deep-audit-2026-08-19.md`**. AI-agent memory §9.11 updated. Runtime code was intentionally not changed in this audit pass.
- 🚧 **Cross-device Supabase implementation (#175, 2026-08-18)** — added the one-venue organization mirror, Realtime invalidation, owner bootstrap fix, event-scoped couple snapshots, invite-link couple/collaborator reads/writes, guest token hydration, guest RSVP RPC, venue-side snapshot registration, and five-migration deployment path for Supabase + Vercel. Live RLS/Realtime/RPC verification is pending creation of the Supabase project. Full report: **`docs/reviews/175-cross-device-supabase-implementation.md`**.
- ✅ **Local-first one-venue / multi-couple remediation (#174, 2026-08-18)** — kept localStorage/sessionStorage as the active source of truth; fixed couple portal guest/RSVP scope leakage, couple-specific browser sessions, predictable local bearer tokens, incomplete reset-to-defaults cleanup, incomplete backup registry, visible file-import accessibility, ConfirmDialog focus trapping, persisted empty-map validation, missing local favicon, coverage tooling, and split-build configuration. Added focused regression coverage for couple isolation, secure tokens, backup completeness, and reset behavior. Full report: **`docs/reviews/174-local-first-multi-couple-remediation.md`**. Runtime cloud/Supabase scaffolding remains intentionally dormant.
- ✅ **Whole-repository code, security, architecture & wedding-venue domain audit (#173, 2026-08-18)** — read all 539 tracked files (~98,464 lines), including 169 runtime source files, 174 tests, 181 docs, four Supabase migrations, and the email Edge Function. Baseline: **729 passing / 11 skipped**; typecheck, event-bus lint, unused-locals scan, and default single-file build green. The audit records five P0 cloud/production blockers: owner membership bootstrap/RLS, Supabase owner role mapping, guest RPC access/IP correctness, local-only password reset/guest access in cloud mode, and destructive layout replace-sync. It also records the partial cloud-domain boundary, overbroad `org_data` RLS, stale entity hydration/event keys, incomplete/secrets-bearing backups, RBAC divergence, upload accessibility violations, broken coverage/split-build scripts, and venue-domain gaps in rotation safety, inventory enforcement, and time/space booking conflicts. Full report: **`docs/reviews/173-comprehensive-platform-code-and-domain-audit-2026-08-18.md`**. Current AI-agent memory was updated in **`docs/AI_AGENT_MEMORY.md` Section 9**. Runtime code was intentionally not changed in this audit pass.
- ✅ **AI Agent Memory & Full-Stack Knowledge Base (#172)** —
  synthesized all product, architectural, UX/UI, and domain-persona knowledge from creating and refining the Wedding Venue Intelligence Platform into an exhaustive, authoritative AI Agent Memory markdown file (**`docs/AI_AGENT_MEMORY.md`**). Covers platform identity and competitive positioning (Tripleseat, Perfect Venue, Planning Pod, AllSeated, Event Temple, Aisle Planner, WeddingWire, Zola); mandatory environment and CI protocol (`typecheck`, `lint:events`, unused-locals, `vitest run`, `build`); versioned storage and typed event-bus architecture; universal UI/UX consistency rules (7 rounded-corner main page headers, modal overflow prevention, Layout Studio header architecture, landing page resizable sidebar, onboarding notification lifecycle); comprehensive persona workflows and functional expertise across all 8 personas (Venue Admin, Venue Manager, Venue Staff, Booked Couple, Wedding Planner, Day-of-Coordinator, Wedding Guest, Preferred Vendor); core module deep-dives (Full Venue Map Designer with base map image uploader, opacity slider, full vector drawing integration, and 4 Preset Zones); and an automated testing and quality assurance playbook for future AI Agents.
  Test count: **742 passing / 12 skipped** (165 test files). Committed.
- ✅ **Design Studio Canvas Auto-Fit, Onboarding Notification Lifecycle & Full Venue Map Designer Base Map & Drawing Integration (#171)** —
  researched, audited, and upgraded the Design Studio canvas positioning, onboarding hint lifecycle, and Full Venue Map Design module (`VenueMapDesigner.tsx`): defaulted the Design Studio canvas to auto-fit the entire canvas to the screen (`fitAndCenterVenue()`) whenever the studio opens or a venue is switched (`AuthenticatedApp.tsx`); upgraded the `"Let's build your layout"` onboarding hint (`FloorPlanCanvas.tsx`) so that on a new user's first visit it auto-dismisses after 2.5 seconds (within the 2-3s window) and writes `'spm_studio_onboarding_seen' = 'true'` to persistent storage so it never shows again on subsequent visits; upgraded `VenueMapConfig` (`src/types.ts`) with optional `backgroundImageUrl`, `backgroundOpacity`, and `drawings` vector shapes; built an accessible `"🖼️ Base Map Image"` uploader card in `VenueMapDesigner.tsx` with file upload (`className="sr-only"`, `<label htmlFor="...">`), URL pasting, and opacity slider (`10%–100%`); built a `"🎨 Map Drawing & Zones"` card in `VenueMapDesigner.tsx` with a `"✏️ Open Full Map Drawing Studio"` button launching `<DrawingTool />`, `"＋ Add 4 Preset Zones"` (`🌳 Ceremony Lawn Zone`, `🅿️ Main Parking Lot`, `🏛️ Main Manor Building`, `🌿 Gardens Boundary`), and shape clearing; and upgraded `VenueMapCanvas.tsx` to render the base image and all vector drawing shapes underneath pins and routes for 100% parity across live editing, couple preview, PNG export, PDF export, and Print.
  Test count: **742 passing / 12 skipped** (165 test files). Committed.
- ✅ **Design Studio Header Cleanup & Logo Upload Engine Remediation (#170)** —
  verified and enforced via automated tests (`Header.test.tsx`) that the Design Studio Header (`Header.tsx`) renders zero Website (`🌐 Website`) and Email (`✉️ Email`) buttons; remediated and hardened the Logo Upload Engine (`BrandingManagement.tsx`) in Admin & System Settings -> Branding -> Logo & Identity by converting the file input to `className="sr-only"` (preventing `.click()` security blocks), wrapping both the thumbnail dropzone and "Upload Logo" / "Change Logo" button in native `<label htmlFor="main-logo-file-upload">` elements, and eliminating `FileReader` race conditions in `processLogoFile(file)` so `localLogoInputRef.current.value = ''` only clears after `onload`/`onloadend` completes or errors. Verified automated logo upload and data URI persistence in `VenuePortal.designConsistencyAudit.test.tsx`.
  Test count: **740 passing / 12 skipped** (163 test files). Committed.
- ✅ **Couples Portal Header Email Mailto Link Standardization (#169)** —
  standardized the venue email address display in the Couples Portal header (`CouplesPortal.tsx`) so that instead of displaying the raw email string, it renders a clean `mailto:` link on the word **`Email`** (`✉️ Email`), matching `🌐 Website` and the email link parity across `VenueDashboard.tsx` and `Header.tsx`. Updated `CouplesPortal.universalBranding.test.tsx` with automated verification for both email and website links in the Couples Portal Hero Banner.
  Test count: **739 passing / 12 skipped** (163 test files). Committed.
- ✅ **Layout Studio Header Restoration, Branding Upload Hardening & Portal Navigation Cleanup (#168)** —
  researched, audited, and resolved studio header architecture, logo uploading, and portal navigation parity across all three personas: restored `<Header.tsx>` at the top of the Design Studio (`Layout Studio`) in `AuthenticatedApp.tsx`; removed venue branding text from the left side of `Header.tsx` and placed prominent 1-click buttons for `🗺️ Venue Map` and `🏛️ Spaces & Layouts`; kept the venue layout dropdown (`Venue: [v.name ▼]`) and Menu button (`☰ Menu`) on the right side of `Header.tsx`; inside the Menu dropdown (`showMenu`), added/moved `⚙️ Admin & System Settings` and `🛠️ Operations Studio` into the menu while removing `📋 Templates` and `🚪 Sign Out` from both desktop and mobile studio menus; implemented `handleLogoUpload` directly inside `BrandingManagement.tsx` using `FileReader` so logo thumbnails and "Upload Logo" buttons open the file picker and save base64 data URIs immediately; updated `BrandingManagement.tsx` live preview section heading to read **`👁️ Live Preview`** and updated the preview card to mirror the actual Home/Landing page (including sidebar preview with `✉️ Email` and `🌐 Website`, `Welcome back to Seven Paths Manor` in a `rounded-2xl shadow-md` banner, `● Active Brand`, and KPI cards); standardized the email address link to read **`✉️ Email`** (`mailto:`) alongside **`🌐 Website`** in both `VenueDashboard.tsx` and `Header.tsx`; removed the `"⚙️ System Settings"` button from the Home page header; removed the `"✕"` close page button from the header of `Portal Chat`, `Vendors`, `Timeline`, and `Operations` when embedded in the dashboard (`inline === true`); and removed the Print Sheet button from the headers of `VendorPanel.tsx` and `StaffOperationsPanel.tsx` (adding a `"🖨️ Print BEO"` button to the BEO Sheet tab toolbar in `StaffOperationsPanel.tsx` so authorized admins can still print BEOs without header clutter).
  Test count: **738 passing / 12 skipped** (163 test files). Committed.
- ✅ **Design Studio Header Consolidation, Landing Page Collapsible & Resizable Sidebar & Couples Portal Tasteful Branding (#167)** —
  researched, audited, and executed an architectural consolidation of the Layout Studio controls and enhanced Landing Page and Couples Portal branding integration across all three personas: removed Branding attributes (venue name, logo, email, website, "Layout Planner") from `Sidebar.tsx` ("Layout tools") and added prominent 1-click buttons for `🗺️ Venue Map` and `🏛️ Spaces & Layouts` right in the Layout tools header; created a clean `⋮ Menu` button in the Layout Tools header containing `👑 Save as Master Layout`, `⚙️ Admin & System Settings` (`Ops and Admin moved into menu`), and `🛠️ Operations Studio`, while removing `Templates` and `Sign out` from the menu; removed the top Layout Studio header (`<Header />` and breadcrumb bar) from `AuthenticatedApp.tsx`, dedicating 100% of vertical viewport height to the canvas and Layout Tools sidebar; moved full branding attributes (**Venue Logo, Venue Name, Tagline, clickable Contact Email, and Website**) into the top of the Landing Page sidebar (`VenueDashboard.tsx`), added a collapse/expand toggle (`◀` / `▶`), and built an active right-edge drag handle supporting **mouse button hold to drag and resize/expand/collapse** the sidebar smoothly between `200px` and `450px` width; and tastefully integrated the Venue Logo, Venue Name, Contact Email (`mailto:`), and official Website link into the Couples Portal (`CouplesPortal.tsx`) top navbar and Executive Hero Banner.
  Test count: **736 passing / 12 skipped** (163 test files). Committed.
- ✅ **Venue Portal Modal Viewport Overflow Resolution & Universal Rounded Header Parity (#166)** —
  researched, audited, and resolved modal viewport clipping and completed universal rounded-corner main page header parity across all dashboard modules: converted `ModalDialog.tsx` to `fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-2 sm:p-4 overflow-hidden` with `w-full max-w-4xl max-h-[94vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden`, a pinned header (`shrink-0 z-20 bg-white`), and scrollable body (`p-5 overflow-y-auto flex-1 min-h-0`) so that modal titles and Close (`✕`) buttons are ALWAYS 100% visible and reachable at the very top of any modal card on any viewport height (permanently fixing the `"Spaces & Layouts"` modal cutoff in Layout Studio); and in accordance with your UX directive, standardized all 7 main page headers across `Home`, `Venue Calendar`, `Couples Portal`, `Preferred Vendors`, `Wedding Timeline`, `Staff & Operations`, and `Portal Chat & Direct Messages` to 100% identical rounded-corner styling (`no-print px-6 py-5 flex items-center justify-between shadow-md rounded-2xl mb-5 text-white shrink-0`, 6px brand-accented left borders, uniform 24px horizontal and 20px vertical padding, and 20px bottom margins).
  Test count: **733 passing / 12 skipped** (163 test files). Committed.
- ✅ **Venue Portal Header Uniformity, Modal Viewport Overflow Remediation & Administrative Styling Parity (#165)** —
  researched, audited, and resolved 6 critical design inconsistencies, modal viewport cutoff issues, and administrative navigation redundancies across all three personas: standardized all 7 section headers in `VenueDashboard.tsx`, `VendorPanel.tsx`, `TimelinePanel.tsx`, `StaffOperationsPanel.tsx`, and `VenueChatPanel.tsx` to 100% identical block header classes (`no-print px-6 py-4 flex items-center justify-between border-b shadow-sm shrink-0 text-white`) and 64px height without rounded corners or bottom margins; standardized `AdminDecorSection.tsx` sub-navigation tabs (`Catalog Items`, `Categories`, `Packages & Styles`) to rounded pill buttons matching `SeatingAndLinensManagement.tsx` and removed the outer white box wrapper; standardized `BackupManagement.tsx` (`Backup & Restore`) to `<BrandedSectionHeader>` and `space-y-6` matching `SecurityAuditManagement.tsx`; consolidated separate `← Dashboard` and `✕` buttons in Admin & System Settings (`AdminPanel.tsx`) and Design Studio (`AuthenticatedApp.tsx`, `Header.tsx`) into a single, intuitive executive exit control (`← Dashboard Home ✕`); upgraded `StudioLayoutsHome.tsx` (`Spaces & Layouts`) to use `<BrandedStatCard>` metrics, dynamic active space card left border (`border-l-4`), and reactive `useBrandingConfig()` styling; and remediated modal viewport top-cutoff in `ModalDialog.tsx` by changing overlay positioning from `flex items-center justify-center` to `flex items-start justify-center p-3 sm:p-6 overflow-y-auto` with `my-auto max-h-[90vh] flex flex-col` and a pinned header (`shrink-0 z-10`) so modal titles and Close (`✕`) buttons are ALWAYS visible and reachable on any viewport height.
  Test count: **731 passing / 12 skipped** (163 test files). Committed.
- ✅ **Venue Portal Design Consistency, Wasted-Space Elimination & Navigation Parity Audit (#164)** —
  researched, audited, and resolved 7 critical design inconsistencies, wasted-space layout issues, and navigation redundancies across Admin & System Settings (`#/admin`) and `VenueDashboard.tsx`: eliminated 56px (`h-14`) of redundant outer header bar and duplicate "← Dashboard" / "Admin" navigation in `AuthenticatedApp.tsx`; upgraded `VenueManagement.tsx` quick presets to start with `"⚡ Quick Presets:"` and uniform dynamic branding (`color-mix`) buttons matching table/chair/linen management; upgraded `AdminDecorSection.tsx` from loose `space-y-6` / `gap-4` to compact `space-y-4` / `gap-3` layout, created an executive **Compact 1-Row Decor Quick Presets strip** (`🌸 Ceremony Florals`, `🕯️ Centerpieces`, `✨ Lighting & Drapery`, `🥂 Lounge & Signage`), standardized catalog search into an **Integrated Search & Action Bar**, and replaced all hardcoded purple classes with dynamic inline branding; upgraded `AccessControlPanel.tsx` by replacing its old gradient hero banner with `<BrandedSectionHeader icon="🔐" title="Access Control" />` and dynamic hierarchy score badges; renamed category `'System Brand & Access'` to **`'Branding, Access, & Configuration'`** across all 8 occurrences in `AdminPanel.tsx`; removed redundant `"← Dashboard"` / `"← Dashboard Home"` buttons across `Venue Calendar`, `Couples Portal`, `Portal Chat`, `Vendors`, `Wedding Timeline`, and `Operations` when embedded inside `VenueDashboard.tsx` with its permanent sidebar navigation menu; and upgraded `VenueDashboard.tsx` so that `Home`, `Venue Calendar`, and `Couples Portal` share the exact same executive branded gradient header banner (`linear-gradient(135deg, config.primaryColor, config.primaryDark)`) as `Portal Chat`, `Vendors`, `Wedding Timeline`, and `Operations`.
  Test count: **729 passing / 12 skipped** (163 test files). Committed.
- ✅ **Venue Admin & System Settings High-Density Executive UX & Toolbar Consolidation (#155)** —
  researched, audited, and refactored the **Venue Portal — Admin & System Settings module (`#/admin` / `AdminPanel.tsx` & 16 sub-components)** to eliminate over 300+ pixels of wasted vertical header overhead and dead space: replaced 4 stacked outer header banners and a 48px-wide vertical category sidebar rail with a sleek **2-Row Executive Admin Toolbar (`~96px height`)** and a full-width horizontal category/sub-tab strip; converted 6 static count boxes into interactive **Quick-Jump KPI Pills** (`🏛️ Venues`, `🪑 Seating`, `🎁 Packages`, `💍 Couples`, `📋 Templates`, `👥 Users`) switching directly to target tabs; redesigned `BrandedSectionHeader` from a 70px gradient box into an ultra-compact **Inline Header Card (`~36px height`)** with left brand accent border; redesigned `BrandedStatCard` from a 90px vertical box into a compact **Horizontal KPI Summary Badge (`~34px height`)** (clickable as a filter button when `onClick` is provided); and consolidated multi-line preset boxes and action bars across `VenueManagement`, `TableManagement`, `ChairManagement`, `LinenManagement`, `FixtureManagement`, `SpacingManagement`, and `GuidelineManagement` into 1-row preset strips and integrated toolbars—more than tripling available vertical real estate for actual operational inventory work.
  Test count: **677 passing / 11 skipped** (156 test files). Committed.
- ✅ **Comprehensive Platform Application & Functional Design Audit Part 2 (#154)** —
  performed a second exhaustive, feature-by-feature, module-by-module, portal-by-portal audit and remediation: upgraded **Dashboard Today Strip (`VenueDashboard.tsx`)** pills to interactive `<button>` elements with `title` tags and 1-click navigation to couple events (`openCouplePortal(id)`) or venue calendar dates (`setSection('calendar')`); upgraded **Upcoming events list (`VenueDashboard.tsx`)** so non-couple calendar items render explicit `"View in calendar →"` action buttons; upgraded **Staff Operations Checklists (`StaffOperationsPanel.tsx`)** with a real-time **Quick Search Box** (`checklistSearch`) filtering items by task title, checklist label, and assigned staff member; upgraded **Preferred Vendor Showcase (`VendorPanel.tsx`)** header with a **"🖨️ Print Directory"** action button and `.no-print` formatting rules; and upgraded **Guest Portal RSVP Confirmation (`GuestPortal.tsx`)** to display complete submission records including plus-one meal choice, dietary notes, attending days, and special accommodations.
  Test count: **673 passing / 11 skipped** (155 test files). Committed.
- ✅ **Comprehensive Platform Application & Functional Design Audit (#153)** —
  executed an exhaustive, feature-by-feature, module-by-module, portal-by-portal audit and remediation across the entire platform: upgraded **Dashboard KPI stat cards (`VenueDashboard.tsx`)** to interactive clickable buttons with accessibility `aria-label`/`title` tags and wired section navigation (`couples`, `ops`, `calendar`); wired onboarding empty-state cards to emit `spm_open_admin_tab` via `onOpenAdmin(tab?: string)` so deep links open exact target tabs in `AdminPanel`; upgraded **Staff Operations Overview (`StaffOperationsPanel.tsx`)** StatCards to clickable buttons jumping to `'tasks'` tab and hardened staff avatar rendering against undefined administrative user names (`(currentUser.name || currentUser.username || 'Staff User')`); upgraded **Couples Portal (`CouplesPortal.tsx`)** guest list navigation for 150+ guest weddings by building a top-level **Quick Guest List Search & Status Filter bar** immediately below RSVP summary cards; and upgraded the **Universal Branding Theme Engine (`src/config.ts`, `src/index.css`)** to define `--accent`, `--accent-light`, and `--accent-dark` aliases on `:root` for **Guest Portal (`GuestPortal.tsx`)** compatibility.
  Test count: **669 passing / 11 skipped** (154 test files). Committed.
- ✅ **Universal Branding Audit & Complete Systemic Remediation: Venue Calendar, Design Studio Subsection Buttons, Wedding Timeline Modules, and UI Design System Primitives (#152)** —
  audited and upgraded the remaining hardcoded branding reported across **Venue Calendar (`VenueCalendar.tsx`)** (category dot/chip styles `getCatStyle`, day cell highlights, drag-over rings, "Open couple" buttons, assignee toggle pills), **Upcoming Events Button & UI Primitives (`src/components/ui/index.tsx`, `VenueDashboard.tsx`, `Sidebar.tsx`)** (`<Button tone="primary">`, `<Badge tone="primary">`, view selector tabs, category filter pills), **Design Studio & Inventory Subsection Buttons (`SeatingAndLinensManagement.tsx`, `StructuresManagement.tsx`, `Sidebar.tsx`)** (tab buttons for **Tables/Seating**, **Chairs**, **Linens**, **Fixtures**, and **Walls** in both Admin Panel and Layout Studio toolbar, plus 8 SVG shape icon strokes), **Wedding Timeline Modules (`TimelinePanel.tsx`, `CoupleTimelineTab.tsx`)** (headers, progress bar fills, "+ Add Event" / "Create New Timeline" buttons, completion checkboxes, day selector tabs), and **Universal CSS Override Engine (`src/index.css`)** (fixed attribute selectors by removing escaped backslashes `[class*="bg-[#4A1942]"]:not([class*="/"])` so browser DOM class attributes match cleanly without specificity collisions).
  Test count: **664 passing / 11 skipped** (153 test files). Committed.
- ✅ **Comprehensive Platform-Wide Universal Branding Audit & Completion (#151)** —
  audited and upgraded the remaining home page Quick Action buttons (`VenueDashboard.tsx`), Upcoming events chips (`catChipStyle`), Sign Out links (`Header.tsx` desktop menu and mobile drawer, `VenueDashboard.tsx` sidebar), and Login Page selection board / input focus styling (`LoginScreen.tsx` focus handlers, `src/index.css` universal CSS overrides for `input:focus`, `.form-input:focus`, `*:focus-visible`, `::selection`); removed hardcoded child text classes from Open Wedding Guest Portal button.
  Test count: **659 passing / 11 skipped** (152 test files). Committed.
- ✅ **Comprehensive Platform-Wide Universal Branding Review: Login, Design Studio, Dashboard, and Live Google Typography Engine (#150)** —
  audited and upgraded the entire platform so the Login page (`LoginScreen.tsx`), buttons in the Design Studio (`Header.tsx`, `Sidebar.tsx`, `StudioLayoutsHome.tsx`, `PropertiesPanel.tsx`, `DecorDesigner.tsx`, `FloorPlanCanvas.tsx`), home page (`VenueDashboard.tsx`, `VenueCalendar.tsx`), and text/fonts dynamically bind to `useBrandingConfig()` and `config.primaryColor`; built `loadGoogleFont` in `src/config.ts` wired into `applyRootStyles(config)` so custom Google fonts (`fontFamily`, `headingFontFamily`) are dynamically loaded in `<head>` and applied across `body`, `#root`, `.spm-studio-root`, `#spm-layout-tool`, and all heading tags on every screen.
  Test count: **659 passing / 11 skipped** (152 test files). Committed.
- ✅ **Universal Branding Theme Engine, Live Portal Theme Switcher, and WCAG AA Contrast Checker (#149)** —
  created Universal Branding Theme Engine with live React state subscription hook `useBrandingConfig()` (`src/config.ts`) wired across all 10 portal surfaces (`AuthenticatedApp`, `VenueDashboard`, `Header`, `Sidebar`, `AdminPanel`, `StaffOperationsPanel`, `VenueChatPanel`, `VenueCalendar`, `CouplesPortal`, `GuestPortal`) and 14 comprehensive CSS override rules in `src/index.css` mapping solid fills, text, hover states, borders, rings, gradients, SVG fill/stroke, and translucent tints (`color-mix(in srgb, var(--primary-color) ...%)`) to dynamic CSS variables; enhanced `BrandingManagement.tsx` with automated **✨ WCAG AA Text Contrast & Accessibility Checker** and **🎨 Live Portal Theme Preview Switcher** (Header Banner, Dashboard KPI, and Portal Chat tabs).
  Test count: **659 passing / 11 skipped** (152 test files). Committed.
- ✅ **Venue Portal Operations: Master Banquet Event Order (BEO) Sheet, Schedule Conflict Detection, and Admin Settings Integration (#148)** —
  created real-time **Banquet Event Order (`'beo'` — `'📜 BEO Sheet'`)** module in Operations (`StaffOperationsPanel.tsx`) with 7 hospitality-standard sections (Client Summary, Room/Layout Setup, Wedding Schedule from timeline, Catering/Dietary policy notes, Staff Shift Roster, Phase Checklists, and Formal Signature Block) with print-optimized styling (`.ops-print-beo`) and couple selector; added **"➕ Load Checklists from Admin"** button calling `handleLoadAdminDefaults` to populate standard operational areas and phase checklists from Admin & System Settings (`OperationsSettingsManagement.tsx`); added **"⚙️ Admin Operations Settings"** quick link; added BEO quick access card and real-time **⚠️ Schedule Conflict Detected** alert banner on Operations Overview tab when overlapping staff shifts occur (`isShiftConflicting`).
  Test count: **659 passing / 11 skipped** (152 test files). Committed.
- ✅ **Admin & System Settings Enhancements: Communication Templates, Operations & Event-Day Checklists, and Security/Audit Diagnostics (#147)** —
  created 3 research-grounded Admin & System Settings modules under System Brand & Access and System & Backup: **💬 Communication Templates (`CommunicationTemplatesManagement.tsx`)** managing Quick Reply chat templates and automated portal email invite wording with interactive dynamic merge tags; **🛠️ Operations & Checklists (`OperationsSettingsManagement.tsx`)** managing default event-day checklists by phase and standard venue operational zones; and **🛡️ Security & Audit (`SecurityAuditManagement.tsx`)** managing workspace authentication rules, session diagnostics, and a comprehensive administrative RBAC audit log with 1-click CSV/JSON exports; added a **"📊 System Status & Quick Diagnostics Banner"** at the top of `AdminPanel.tsx` displaying live system health and quick links.
  Test count: **659 passing / 11 skipped** (152 test files). Committed.
- ✅ **System Brand & Access Enhancements, Live CSS Variable Branding, and Portal-to-Portal Chat & DMs Module (#146)** —
  fixed branding color scheme so custom primary, dark, light, and accent colors dynamically affect all buttons, badges, widgets, hover states, and sidebar items (`src/index.css`, `applyRootStyles` in `src/config.ts`); updated User Management (`UserManagement.tsx`) with a dedicated **"💍 Couples & Guest Portal Accounts"** tab managing invite tokens, Day of Coordination service timeline access, and direct chat links; updated Access Control (`AccessControlPanel.tsx`) with a dedicated **"💍 Couples & Guest Portal Access Rules"** tab surfacing all 8 granular external RBAC policies; created **"💬 Portal Chat & Direct Messages"** home-screen module (`VenueChatPanel.tsx`) with dual couple/team DM tabs, event header linkage, unread message badges, role-differentiated message streams, and 4 **⚡ Quick Reply** response templates; wired into Dashboard sidebar, Quick Actions, Header menu, and Unread KPI card/banner.
  Test count: **647 passing / 11 skipped** (148 test files). Committed.
- ✅ **Venue Portal Timeline module exit fix & comprehensive UI/UX enhancement pass (#145)** —
  fixed Timeline module exit bug and `spm_open_timeline`/`spm_open_vendors`/`spm_open_ops` modal trap where exiting or emitting events warped to `#studio`; wired events to navigate directly to `#dashboard` inline section and return to dashboard home on close; added explicit **"← Dashboard"** buttons next to close icons in `TimelinePanel.tsx`, `VendorPanel.tsx`, and `StaffOperationsPanel.tsx`; added **"← Dashboard Home"** buttons to `VenueCalendar` and `Couples Portal` dashboard views; updated sidebar highlighting so all modules show active state; added interactive **Summary Stats KPI card**, **Search & Category Filter bar** (`eventSearch`, `eventCategoryFilter`, `hideCompletedEvents`), and **"🖨️ Print"** button to `TimelinePanel.tsx`; added **"🛠️ Operations"** button to `Header.tsx` menu dropdown.
  Test count: **638 passing / 11 skipped** (145 test files). Committed.
- ✅ **Venue Portal navigation & dashboard UX enhancement pass** —
  fixed inline panel exit bug where closing Vendors, Timeline, or Operations on
  Venue Dashboard warped to `#studio` (now returns to Dashboard `'home'` section);
  added Vendor Showcase and Timeline Studio buttons to Dashboard quick actions; added
  live Unread Couple Messages alert banner on Dashboard; made onboarding category links
  open Admin directly to `venues` or `packages` tab; added "← Dashboard" button to AdminPanel;
  filtered studio-specific canvas commands from Header menu on non-studio pages; added
  instant text search to StudioLayoutsHome template gallery.
  Test count: **632 passing / 11 skipped**. Committed.
- ✅ **Venue Portal Timeline <-> Couples Portal integration & Day of Coordination gating** —
  added dedicated **"📅 Timeline"** tab to Couples Portal (`CoupleTimelineTab.tsx`) so
  couples and hired planners can build and manage wedding timelines; updated Venue Portal
  Timeline module (`TimelinePanel.tsx`) with a Couple Event selector; when Day of Coordination
  service ($1,000) is booked (`hasVenueCoordination`), venue admins have full collaborative
  editing permission that syncs with Couples Portal; when Day of Coordination is not booked,
  venue admins see a read-only preview of the couple/planner's schedule with a one-click
  "+ Add Day of Coordination Service ($1,000)" button to unlock collaborative editing.
  Test count: **625 passing / 11 skipped**. Committed.
- ✅ **Operations Studio (`StaffOperationsPanel`): shift schedule conflict detection & bulk checklist reset** —
  added real-time detection of overlapping staff shifts (`isShiftConflicting`) with an
  amber alert banner and pulsing `⚠️` badges on conflicting shifts in Timeline and List
  views; added "🔄 Reset for Next Event" bulk action button in Checklists tab to reset all
  checklist items across tasks to uncompleted for the next wedding.
  Test count: **617 passing / 11 skipped**. Committed.
- ✅ **Operations Studio (`StaffOperationsPanel`) comprehensive venue-admin pass** —
  moved "🖨️ Print Sheet" button to header and implemented printable `.ops-print-report`
  Daily Operations Report; fixed shift start/end time timezone off-by-one bug using
  `toLocalDatetimeInput`; fixed timeline early-shift truncation; added task Search &
  Staff filter bar; added Checklists "Show incomplete items only" toggle; added area
  deletion cascade scrubbing of `task.assignedAreas`; added corrupt JSON storage backup.
  Test count: **615 passing / 11 skipped**. Committed.
- ✅ **Design Studio: layout review & commenting pins + custom print/export legend toggles** —
  added `LayoutReviewPin` type and canvas markers to `FloorPlanCanvas`, added
  "📍 Add review pin" mode, coordinate popover comment input, and review pins list
  to `CoupleLayoutPreview`, wired pin persistence in `CoupleManagement`; added
  interactive checkbox toggles in `PrintView` to selectively show/hide dietary
  notes, Linen Color Key, and Room Setup Checklist on printed floor plans.
  Test count: **607 passing / 11 skipped**. Committed.
- ✅ **Design Studio: print/export scope polish & empty Master Layout warning** —
  added scoped `@media print` rules (`.no-print`, `.spm-studio-chrome`, and
  `body:has(.spm-print-view)`) so printing from `PrintView` or directly from
  the Design Studio (`#/studio`) or Full-Venue Map (`#/venuemap`) hides app
  chrome and expands the canvas cleanly without cropping; added `🖨️ Print`
  button to `VenueMapDesigner`; added confirmation warning dialog before saving
  an empty working layout (`0` tables, `0` fixtures, `0` decor items) as a venue's
  Master Layout. Test count: **602 passing / 11 skipped**. Committed.
- ✅ **Venue Map admin fixes** — palette now drives point placement (was a dead
  control), the "Save point" unsaved-changes indicator is accurate, deleting a
  point drops now-empty walkways, a new **Map coverage** panel lists venues
  missing a pin (with one-click "+ Add pin"), linking a venue auto-labels the
  point, route-building highlights the in-progress pins, the exported/printed
  map now carries a title + color legend, the module guards leaving with
  unsaved changes ("● Unsaved" + confirm), walkways can be renamed inline, a
  fresh map shows an empty-state "how to start" hint, and the designer gained
  undo/redo (buttons + Ctrl/Cmd+Z) covering field-by-field edits too, keyboard
  Delete, a "👁 Preview as couple/guest" read-only toggle, and a "⧉ Copy"
  duplicate-point action. Floor-plan keyboard shortcuts are now scoped to the
  Studio view. Test count: **569 passing / 11 skipped**. Committed.
- ✅ **Design Studio venue-admin pass** — removed dead guest props from the
  Properties panel (venue guest management was removed), aligned the zoom numeric
  input to the slider's 10–300% range, and added couple-capacity verification to
  the canvas (shows the booked couples, the largest expected guest count, and a
  ⚠️ under-capacity flag when placed seats can't cover it). Test count:
  **574 passing / 11 skipped**. Committed.
- ✅ **Design Studio follow-up** — "Clear All Items" is now undoable (was
  irreversible), and the Studio space picker shows each space's booked couples and
  largest expected guest count so the venue can prioritize seating. Test count:
  **577 passing / 11 skipped**. Committed.
- ✅ **Design Studio: confirm before deleting a saved layout** — the Header's Load
  Layout dialog now confirms before deleting a saved layout (was a one-click,
  irreversible delete). Test count: **578 passing / 11 skipped**. Committed.
- ✅ **Design Studio: unsaved-changes guard + Save Layout overwrite** — the working
  canvas layout now tracks dirty state (`layoutDirty`), warns before leaving the
  Studio (Dashboard/Admin/Venue Map/logout) or refreshing, and shows a "● Unsaved"
  badge. The Save Layout dialog now offers **Overwrite existing** (updates in
  place) vs **Save as new copy** instead of silently duplicating. Removed a
  double clear-confirmation. Test count: **581 passing / 11 skipped**. Committed.
- ✅ **Design Studio venue-admin round 2** — Properties panel Duplicate/Delete are
  now undoable (matched to keyboard), "Clear Master Layout" now confirms, and the
  venue-switch + template-overwrite guards use the dirty tracker instead of item
  count (protects metadata-only edits from silent loss). Test count:
  **582 passing / 11 skipped**. Committed.
- ✅ **Design Studio: decor data-integrity** — deleting a decor arrangement now
  scrubs stale `appliedArrangementId` references from placed tables/fixtures (no
  more broken "Design Active" badge / "Edit Design"). Test count:
  **584 passing / 11 skipped**. Committed.
- ✅ **Design Studio: mobile/tablet responsiveness** — the Sidebar & Properties
  panel now overlay the canvas on small screens (full-width canvas, default
  collapsed), desktop prefs are preserved, and the canvas drag/pan uses pointer
  events so it works on touch. Test count: **587 passing / 11 skipped**. Committed.
- ✅ **Design Studio: two-finger pinch-to-zoom** — the canvas now zooms via
  two-finger pinch on touch, anchored to the pinch midpoint (clamped 25–200%);
  a second finger while dragging an item cancels the drag and starts a pinch.
  Test count: **588 passing / 11 skipped**. Committed.
- ✅ **Design Studio: exterior/architectural inventory tracking** — exterior
  features now count their placed instances (previously always 0), so they show
  remaining inventory and block out-of-stock placement like interior items. Logic
  extracted to a tested `inventoryUsage` helper. Test count:
  **592 passing / 11 skipped**. Committed.
- ✅ **Design Studio: property-panel edits & design-application are undoable** —
  metadata edits (label/linen/chairs/applied design, coalesced per item) and
  dropping a decor design onto a table now push an undo snapshot, so every canvas
  edit is undoable. Test count: **592 passing / 11 skipped**. Committed.
- ✅ **Design Studio: clear undo history when the layout is replaced** — the undo
  stack now resets on venue switch / load-layout / load-template, so Undo can't
  restore a different venue's layout (clearHistory was previously never called).
  Test count: **593 passing / 11 skipped**. Committed.
- ✅ **Design Studio: saved-layout list refreshes after saving** — the Header's
  "Load Layout" list now updates in the same tab immediately after saving or
  overwriting (previously stale until reload in local mode). Test count:
  **593 passing / 11 skipped**. Committed.
- ✅ **Interactive Full-Venue Map — dedicated Studio module (`#/venuemap`)** — the
  hybrid map designer (`VenueMapCanvas` shared renderer + `VenueMapDesigner`
  canvas-with-side-panel) now lives in its own module/route inside the **Design
  Studio** (not buried in Admin): drag/click-to-place points (spaces, lodging,
  parking, entries, amenities, paths), precise numeric entry + GPS + venue-linking,
  walkway route drawing, and PNG/PDF export of the "Venue Map". The Studio home
  "Design the full-venue map" shortcut and the Studio breadcrumb's "🗺️ Venue Map"
  button route here; Admin Wayfinding & Rules now shows a map summary + "Open map
  designer →" button instead of embedding the editor (single source of truth). Map
  editing stays RBAC-gated to admins. Test count: **541 passing / 11 skipped**.
  Committed.
- ✅ **Map canvas size editing** — the designer's side panel now has a "Map size"
  block to set the canvas width/height (clamped to 20–500, points re-clamped when
  the map shrinks beneath them; pure `updateMapSize` helper + tests). Test count:
  **543 passing / 11 skipped**. Committed.
- ✅ **Guest portal maps use the shared `VenueMapCanvas`** — the guest portal's
  "Venue Map" card and the Wayfinding tab no longer hand-roll their own SVG map;
  both now use the shared renderer (one source of truth), keeping the tap-a-pin
  → open-in-Google-Maps behavior via `onPointClick`. Removed the duplicated
  `routePolyline` map code. Test count: **545 passing / 11 skipped**. Committed.
- ✅ **Richer lodging drill-in on the couple's map** — clicking a lodging space on
  the couple's venue map now opens a focused room-assignment panel (not just a
  jump to the Guests tab): pick the venue's configured rooms (floors→rooms + legacy),
  see occupancy/capacity with a full-room guard, assign guests to a room or a
  free-text room, and remove assignments — all while staying in the map context.
  Test count: **551 passing / 11 skipped**. Committed.
- ✅ **Couple drill-in via the map** — the couple's Venue Spaces tab now shows an
  interactive map; clicking a space opens its layout editor, clicking a lodging
  point jumps to guest/room assignment. Committed.
- ✅ **Guest persona: full journey** — added integration tests covering sign-in lookup
  (by email/name/token), access gating (portal/lodging/RSVP/map), multi-day celebration
  countdown (before/during/after), and the post-event access grace window. Test count:
  **524 passing / 11 skipped**. Committed.
- ✅ **Couple persona: full journey** — added integration tests exercising the couple's
  end-to-end flow through the real services: invite-link resolution, adding
  collaborators (with email dedupe), answering questions, selecting spaces, checklist,
  vendors, guests + invite links + RSVPs, layout design → submit → venue approve,
  complete event, and delete cascade. Test count: **520 passing / 11 skipped**.
  Committed.
- ✅ **Venue-admin persona: Print/export** — fixed a genuine bug: the built-in
  "Traditional Ceremony" template referenced a non-existent table spec
  (`ceremony-chair-row`; correct id is `seating-ceremony-row`), which broke template
  rendering and made backup restore fail preflight validation. Added persona tests
  for floor-plan PDF validity and backup/restore round-trip. Test count:
  **513 passing / 11 skipped**. Committed.
- ✅ **Venue-admin persona: Admin & System Settings** — added tests for Access Control
  (RBAC role→permission resolution incl. inheritance, fail-closed on deleted role)
  and team invites (create + accept in local mode). Verified RBAC roles/groups/audit
  are in backup domains and user management has validation + filters. Test count:
  **511 passing / 11 skipped**. Committed.
- ✅ **Venue-admin persona: Operations & Staffing** — hardened the Operations panel's
  task/area/shift load to parse defensively (corrupted data no longer crashes the
  panel); added persona tests for staff tasks + checklist progress and the
  calendar→shift link (assign/unassign/delete reconcile). Test count:
  **506 passing / 11 skipped**. Committed.
- ✅ **Venue-admin persona: Lodging Studio flow** — added integration tests verifying
  the multi-floor lodging venue (floors/rooms/capacities) persists, over-capacity
  guest assignment is detected, and a legacy single-floor venue (rooms w/o floors)
  is handled. Test count: **501 passing / 11 skipped**. Committed.
- ✅ **Venue-admin persona: Layout Studio canvas flow** — added integration tests
  exercising the layout-editing mutations a venue admin uses: place table/fixture/
  decor, move/duplicate/remove, save a master layout onto the venue, and load a
  template onto the canvas. Test count: **498 passing / 11 skipped**. Committed.
- ✅ **Venue-admin persona test coverage** — added integration tests that exercise the
  venue-admin flows through the real service layer: catalog setup (spaces, tables,
  fixtures, templates, guidelines) and the couples & events workflow (create couple,
  assign package, derive guest events, layout submit→approve, complete event).
  Test count: **493 passing / 11 skipped**. Committed.
- ✅ **Venue-admin focused sweep**: package delete now warns when couples are assigned
  (prevents silently detaching them + removing derived guest events); couple's
  preferred-vendor picker shows rating/website/description the venue curated; venue
  timeline date-only days display as the correct local day (UTC off-by-one); dashboard
  deduped duplicate "Approvals due" KPI into a useful "Blocked dates" metric; venue
  calendar gained a Delete action (was impossible to delete events). Committed.
- ✅ **Venue calendar: add Delete action on event detail** — venue admins previously
  could create/edit calendar events but had no way to delete them. Added a Delete
  action (with confirm) that also cleans up linked staff shifts. Committed.
- ✅ **Venue dashboard: dedupe KPIs** — replaced the duplicate "Approvals due" KPI
  (same count as "Awaiting layout review") with a useful "Blocked dates" availability
  metric. Committed.
- ✅ **Guest-event removal scrubs RSVP references** — removing a guest event now also
  removes it from guests' RSVP `attendingEvents`, so per-event headcounts and guest
  itineraries don't reference a deleted event. Committed.
- ✅ **Add-on removal cleans up suggested setup tasks** — removing a lodging/activity/
  ceremony add-on now removes the auto-suggested venue setup task it created (only
  tasks the couple's action marked suggested; venue's own custom tasks stay).
  Committed.
- ✅ **Wayfinding point coordinate validation** — fixed a bug where clearing or
  typing non-numeric X/Y coordinates (or going out of bounds) produced NaN/0 and
  broke the venue map; addPoint now validates finite non-negative in-bounds values.
  Committed.
- ✅ **Couple onboarding "next step" CTA** — the couple's Overview now shows a smart
  "Next step" card that walks them through Questions → Spaces → Design → Guests →
  Portal in order (with an inline CTA), and a "completed" state. Committed.
- ✅ **RSVP deadline guidance** — added a hint under the couple's RSVP-deadline field
  and a "Set to ~3 weeks before your event" quick-set button. Committed.
- ✅ **Plus-one per-event headcount**: the couple's "RSVPs per event" now includes
  plus-ones in attending counts (and over-capacity flagging). Committed.
- ✅ **Plus-one headcount**: the couple's Attending KPI and catering meal accounting
  (and the venue's catering summary) now include plus-ones. Committed.
- ✅ **Venue couple card space names**: the venue's couple list now shows the selected
  space names (tooltip) for at-a-glance planning. Committed.
- ✅ **Couple guest-portal password**: couples can now set / change / remove a guest
  portal entry password (hashed) from their Portal Settings. Committed.
- ✅ **Guest RSVP event checkboxes safe-time**: the "Which events will you attend?"
  checkboxes now use safe time formatting (no crash on malformed times). Committed.
- ✅ **Venue dashboard recurring events**: the Today strip + Upcoming pipeline now
  expand recurring calendar events (weekly/monthly/yearly) across all occurrences.
  Committed.
- ✅ **Guest personal events: add-to-calendar + safe time**: the guest's "Your invited
  events" list now has an Add to calendar action and uses safe time formatting.
  Committed.
- ✅ **Couple-event guest-count validation**: the venue's create/edit couple event
  forms now reject NaN/negative/0 guest counts with a clear error. Committed.
- ✅ **Package & add-on numeric guards**: package forms now clamp prices/guest counts
  to finite non-negative values and require `maxGuests > 0` (instead of silently
  saving "unlimited"); add-on price is guarded from NaN/negative. Committed.
- ✅ **Guest-access-closes guard**: the couple's Portal Settings "Guest access closes"
  field now treats empty/NaN as the default 36h instead of 0/NaN (which would close
  the portal at event-day end or break grace-period math). Committed.
- ✅ **Guest CSV export includes Table/Seat & Room**: the couple's exported guest list
  now carries seating and lodging assignments (which were editable but not exported).
  Committed.
- ✅ **Collaborator role editing**: the couple can now change a collaborator's role
  (planner/family/vendor) after inviting, without removing + re-inviting. Committed.
- ✅ **Staff-shift data-integrity**: deleting a calendar event now cascade-deletes its
  linked staff shifts; shift sync now reconciles (removes dropped assignees, updates
  times/roles, clears on unassign-all) instead of only adding. Committed.
- ✅ **Calendar event detail + guest-event location**: the venue calendar detail now
  shows end time, venue space, notes, and recurrence; couples can set a guest
  event's location (shown in venue + guest itinerary). Committed.
- ✅ **Safe date formatting, guest-event day/time editing, capacity warnings**: the
  couple portal no longer crashes on malformed dates; the couple can edit a guest
  event's day + start time; the venue creation form warns when guest count exceeds
  package cap; the RSVP per-event summary flags over-capacity attendance. Committed.
- ✅ **Guest seat/room assignment, capacity guards, deadline display, add-ons total**:
  couple can now assign each guest a table/seat & room (was shown in the guest portal
  but not editable; surfaced in venue guest view too); guarded guest-event capacity
  from NaN/0; fixed RSVP-deadline message off-by-one; added selected add-ons count +
  total on the Package tab. Committed.
- ✅ **Brand consistency completion + calendar/couple/warning/mobile round**: brand
  purple extended to every active venue/admin surface (removed leftover indigo);
  blocked-date conflict detection now covers multi-day couple events; couple portal
  warns on submitting with no drawn layout; venue couples admin flags over-capacity
  guest counts; venue dashboard sidebar is now a mobile drawer. Committed.
- ✅ **Venue-branding + per-couple guest-portal theming (user-directive)**: the
  Couples Portal now uses the venue brand accent (was off-brand indigo); added a
  per-couple **Theme color** setting so each couple can brand their own guest
  portal, which falls back to the venue brand color by default. Also: venue
  calendar event-form validation, and guest search + RSVP filter in the couple's
  guest list. Committed.
- ✅ **Couples portal + dashboard polish round**: couple checklist grouped by phase;
  fixed add-on→guest-event auto-derivation for add-ons added later; replaced the
  horizontal-scroll tab bar with wrapping pill tabs; fixed the dashboard "This week"
  widget (was 30-day window) and surfaced multi-day couple events on every booked
  day in the dashboard; guest RSVP submit now says "Update RSVP" for returning
  guests. Committed.
- ✅ **Guest-count ↔ seating-capacity verification (couple layout)**: the couple's
  layout editor now computes seating capacity from placed tables and shows
  "Seats X / Y guests" with an amber warning when a space under-seats the couple's
  expected guest count; the venue's approval queue shows the same per-space capacity
  vs guest count so it can verify before approving. Committed.
- ✅ **Guest RSVP deadline bug fix**: a date-only RSVP deadline (from the couple's
  portal settings date input) resolved to midnight UTC and closed RSVPs a day early
  in US timezones; it now stays open through the end of the local deadline day.
  Committed.
- ✅ **Venue calendar enhancements**: couple events now show guest count, and
  multi-day couple events are surfaced on **every** booked day (not just the first).
  Committed.
- ✅ **Guest RSVP a11y**: attending Yes/No buttons now carry `aria-pressed` for
  keyboard/screen-reader users. Committed.
- ✅ **Admin & System Settings reorg (user-directive)** — the venue Admin is now a
  settings console titled "Admin & System Settings" with five categories
  (Venues & Inventory, Layout Content, Couples Portal, System Brand & Access,
  System & Backup). Decor moved into Venues & Inventory; Spacing moved out of
  Tables/Chairs/Linens into Layout Content; Event Questions moved into Couples
  Portal; the Guest Portal config was removed from the venue (couples configure
  their own); Users/Access/Invites moved into System Brand & Access. Navigation
  redesigned to a category rail + wrapping section pills — the horizontal
  scrollbar is gone. Committed.
- ✅ **Couples Portal naming consistency** — renamed the venue dashboard's
  "Couples & Events" section (sidebar label, KPIs, onboarding card, section heading)
  and the CoupleManagement admin heading to "Couples Portal", matching the admin
  category. Committed.
- ✅ **Dashboard + Design Studio UX polish** — dashboard sidebar/quick-action
  "Admin" → "Admin & System Settings" (quick actions redesigned to stacked buttons);
  Design Studio's Workspace Snapshot + Grid & Snap moved from every Layout Tool
  section into the Settings section; Quick find made collapsible (default collapsed);
  Layout Tools section tabs now always show their names as labeled pills. Committed.
- ✅ **A2 — Vendor preferred-vendors showcase** (dynamic categories; payments/budget
  removed). Committed.
- ✅ **A1 — Removed venue guest management** (dashboard/header/studio/overview
  entries; Properties shows read-only seating capacity). Committed.
- ✅ **A3 — Admin as its own page (`#/admin`)** — dedicated full-page destination
  with header + back button; hash routing; dashboard/header route to it. Committed.
- ✅ **A4 — Layout Studio as its own module (`#/studio`)** — dedicated route with a
  Layout Studio breadcrumb strip (module name + space + back). Committed.
- ✅ **A5 — Design-system consistency pass (foundation)** — shared `src/components/ui`
  kit (Button/Card/Badge/SectionHeader/EmptyState) adopted in the dashboard; more
  surfaces can migrate incrementally. Committed.
- ✅ **B1 — Dashboard**: live "Unread couple msgs" + "Approvals due" KPIs, a
  "Today" strip, and This-week/Later pipeline grouping. Committed.
- ✅ **B2 — Vendor showcase**: shows how many couples use each preferred vendor.
  Committed.
- ✅ **B3 — Admin**: richer per-category landing summary (Venues, Tables/Seating,
  Packages, Couples, Templates, Users). Committed.
- ✅ **B5 (partial) — shared date/time helpers** (`src/utils/dateTime`). Committed.
- ✅ **B1 (added) — availability/blocked dates**: new 'Blocked / Unavailable'
  calendar category so the venue can mark dates unbookable. Committed.
- ✅ **B4 — Layout Studio home** — new `StudioLayoutsHome` panel in the studio
  breadcrumb ("🏛️ Spaces & Layouts"): a space picker with per-space capacity +
  master-layout status, a capacity summary strip (spaces / total seating / spaces
  with master), and a quick category-filtered template gallery. Template application
  now flows through one shared `handleTemplateSelect` (overwrite guard + space
  switch) reused by both the gallery and the standalone `TemplateSelector`.
  Print/export was already covered by PrintView. Committed.
- ✅ **B5 — confirm unification**: new promise-based `useConfirm()` hook renders one
  shared, accessible `ConfirmDialog` (trap focus, Escape-cancel, non-blocking).
  Replaced all remaining native `window.confirm` calls (PackageManagement
  packages/add-ons, VenueWayfindingManagement map reset, CoupleManagement event
  delete, CustomVenueBuilder unsaved-changes guard). Toast was already unified via
  `showToast`; modals via `ModalDialog`/`CenteredModal`. Reduced-motion media query
  already present globally. Committed.
- ✅ **B5 — VenueCalendar adopts shared `ui` kit**: view switcher → `Button`
  (tone + `aria-pressed`), “+ Add event” → success `Button`, category legend →
  `Badge`, and day/agenda empty states → `EmptyState`. Keyboard focus/a11y are
  covered by the global `:focus-visible` styles + reduced-motion media query.
  Committed.
- ✅ **Cleanup (from studio/calendar pass)** — studio home now routes through the
  venue-switch guard (no silent unsaved-work loss), is scoped to `selectableVenues`,
  and the dead `'guests'` modal was removed. Committed.
- ✅ **B5 — VendorPanel adopts shared `ui` kit** (empty state, add/save/cancel
  buttons) for consistency with the dashboard/calendar. Committed.
- ✅ **Calendar data-integrity — blocked-vs-booked conflict warning**: the venue
  calendar now flags any date that is both "Blocked / Unavailable" AND holds a
  confirmed couple event, so a venue can't silently block a booked day. Logic
  extracted to a tested pure helper (`src/utils/calendarConflicts`). Committed.
- ✅ **Dashboard — actionable review KPIs**: "Awaiting layout review" and
  "Approvals due" cards are now buttons that open Couples & Events; the section
  gained a "Review & approve layouts in Admin" action and a per-couple "Review →"
  link when a layout is pending/changes-requested. Committed.
- ✅ **Brand consistency — UI kit primary tone aligned to the venue brand**: the
  shared `Button`/`Badge`/`inputCls` primary accent was indigo while the rest of the
  app is the purple brand (`#4A1942`). Aligned the kit + StudioLayoutsHome + calendar
  "Design Studio" button to the brand for platform-wide consistency. Committed.
- ⏳ **B5 (remaining)** — migrate remaining standalone panels (ops, timeline)
  onto the shared kit for full consistency.

## Guiding principles (from research)
- **Venue ops ≠ couple planning.** The best tools separate the venue's back-office
  (bookings, availability, preferred vendors, floor plans, staffing, contracts) from
  the couple's guest/planning portal. Remove venue-side guest management entirely.
- **Preferred-vendor marketplace.** Tripleseat's "Marketplace" and Aisle Planner's
  vendor directory show that a venue's vendor tool is a *showcase* organized by
  category (food, bar, photography, floral…), not a payment ledger.
- **Floor-plan/diagramming is its own module** (AllSeated, Planning Pod): a
  dedicated layout studio, not buried inside generic "admin".
- **Admin is a destination, not a modal.** Group tools by category with clear
  navigation and minimal chrome (consistent with dashboard best practices).
- **Consistent design system**: one palette, type scale, button/card/tab styles
  across dashboard, studio, admin, and portals.

---

## A. Directly requested changes (P0)

### A1. Remove guest management from the Venue portal
**Current:** `GuestPanel` (guest CRUD, seating assignments, CSV import, meal/RSVP)
is reachable from the venue Header ("Guests"), the studio overlay, and the
dashboard sidebar. It's wired to the venue's `layoutState.guests`.

**Action:**
- Remove the **Guests** sidebar item, Header "Guests" button, and `open('guests')`
  pathways from the venue side.
- **Keep guest *seating capacity* on the layout canvas** (a table's capacity still
  uses guest count for over-capacity warnings) but decouple it from a venue-managed
  guest list — the couple owns guests. If the canvas seating count needs a number,
  use the couple's `guestCount`/RSVP totals from the couple portal instead of a
  venue-edited list.
- Guest management remains fully in the **Couples Portal** (already built).

### A2. Vendor management = preferred-vendors showcase by category
**Current:** `VendorPanel` has tabs *List / Add / Budget / Payments* with
`VendorPayment`, `contractAmount`, `depositPaid`, `finalPaymentPaid` etc. —
i.e. a payments/budget ledger. Categories are a fixed const.

**Action:**
- **Remove** Payments + Budget tabs and the `VendorPayment` model (deprecate the
  storage key; keep backup tolerant of its absence).
- **Preferred vendors by category**: each vendor is a "preferred vendor" with
  name, category, contact, phone, email, website, notes, a short description, and
  optional photo — a showcase a couple can browse (already used in the Couples
  Portal's vendor picker).
- **Venue-created categories**: replace the fixed `VendorCategory` union with a
  stored category list (id, label, icon) the venue manages (Food/Catering,
  Bar Service, Photography, Floral, DJ/Band, Officiant, etc.). Seed sensible
  defaults. Update all consumers to read dynamic categories.

### A3. Admin tools open in their own page, best-in-class by category
**Current:** `AdminPanel` is a full-screen overlay (or inline in the dashboard).
Tabs are grouped into 4 sections but render in one modal.

**Action:**
- Give Admin its **own full-page destination** (a `#/admin` route or a dedicated
  view that replaces the dashboard content, not an overlay) with:
  - A **left nav by category** (Venue & Layout, Design & Content, People & Access,
    Couples & Events, Portal & Brand) with icons and counts.
  - Each category page has a consistent header, search, and responsive card/list
    layout (per dashboard best practices: hierarchy, whitespace, clear grouping).
  - Keep the "inline in dashboard" option available via the dashboard sidebar.

### A4. Venue Layout creation as its own module
**Current:** The layout canvas ("Design Studio") is a `view` inside
`AuthenticatedApp` sharing the app shell with panels.

**Action:**
- Promote the canvas to a **dedicated "Layout Studio" module** with its own route
  (`#/studio`) and a focused workspace (sidebar palette + canvas + properties),
  separated from dashboard and admin. Give it a clear breadcrumb/back path and a
  "Layouts" home (list of venue spaces/templates) so it reads as its own product,
  not an overlay.

### A5. UI/UX consistency across the platform
**Action:**
- Centralize shared UI primitives (buttons, cards, section headers, badges, empty
  states, form inputs, modals) into a small design system used by dashboard,
  studio, admin, and both portals — consistent spacing, radius, typography, color
  semantics (success/warning/danger), and icon usage.
- Unify the top bar / sidebar so dashboard, studio, and admin share the same nav
  language and return paths.

---

## B. Additional venue-expert improvements (P1)

### B1. Dashboard
- Add **booking pipeline** feel: upcoming events grouped by status (confirmed /
  awaiting layout / complete), plus a "today" strip.
- **KPI accuracy**: pull open-house and staffing counts live; add "unread couple
  messages" and "approvals due" counters.
- Add an **availability/blocked calendar** helper (mark a date unbookable).
- Empty states: when a section has no data, give a clear "how to" action (already
  started in onboarding).

### B2. Vendor (preferred) showcase
- Category tiles view (Food / Bar / Photography / Floral…) with vendor cards and
  a "preferred" badge; search + filter by category.
- Show which couples are using each preferred vendor (link to couple vendors).
- Reusable vendor detail card shown in the Couples Portal (already wired) and the
  venue.

### B3. Admin organization
- Per-category landing summaries (counts of venues, tables, users, packages).
- Batch/undo affordances and inline validation consistent across asset editors.

### B4. Layout Studio
- Space picker + per-space master layouts; quick template gallery; export (PNG/PDF)
  per layout; capacity summary.

### B5. Consistency/polish
- One shared toast + confirm + modal system everywhere.
- Keyboard a11y, focus states, and reduced-motion across all surfaces.
- Consistent date/time formatting helpers.

---

## C. Planned implementation phases (proposed)
1. **Data/model**: dynamic vendor categories; deprecate `VendorPayment`;
   decouple venue guest list.
2. **Vendor showcase** (remove payments/budget; category tiles).
3. **Remove venue guest management** (UI + wiring); keep seating capacity.
4. **Admin as own page** (route + category nav).
5. **Layout Studio as own module** (route).
6. **Design-system pass** for consistency.

*This is intentionally a plan-first review: the requested changes are large and
interdependent. A few decisions need your confirmation before I build — see the
questions in the conversation.*
