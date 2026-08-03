# Module Review Map & Roadmap

This map tracks the module-by-module audit. Modules 01–07 were delivered on `main`
via a prior/parallel pass and were QA-verified as part of this review. Work
continues from Module 08. The user asked to look for **consolidation** to
simplify UI/UX and for **new features** to make the platform more complete.

## QA status — Modules 01–07 (verified on `main`)
| # | Module | Files | QA status |
|---|---|---|---|
| 01 | Data & persistence | storage, venueData, backup/restore, recovery | ✅ Merged my complementary fixes (backup versioned-round-trip bug, design-domain gaps, merge mode, single registry). 253 tests green. |
| 02 | Config & branding | config, color, BrandingManagement | ✅ No regressions. Config now single-sourced. |
| 03 | Event bus & app shell | App, AppErrorBoundary, global storage-error toasts | ✅ No regressions. |
| 04 | Auth & RBAC | auth, LoginScreen, bootstrap admin hash | ✅ Acceptable; bootstrap password hash + forced-change gate. |
| 05 | Validators & import | backupImport preflight cross-ref validators | ✅ No regressions. |
| 06 | Collision & layout validation | useLayoutState warnings, live banner | ✅ No regressions. |
| 07 | Header & sidebar | Header role label | ✅ No regressions. |

## Roadmap — Modules 08+ (this review)
| # | Module | Scope | Status |
|---|---|---|---|
| 08 | Layout canvas & interaction | FloorPlanCanvas, Sidebar, PropertiesPanel, DrawingTool, useLayoutState | ✅ zoom-to-cursor, pan clamp, keyboard a11y + nudge, fix undo-stack flood |
| 09 | Guest panel & guest mgmt | GuestPanel, assignments, seating capacity, CSV | ✅ CSV import: toasts instead of alert, full column mapping, dedup; pure testable parser |
| 10 | Admin panel shell + venue mgmt | AdminPanel, VenueManagement, admin tabs | ✅ group 15 tabs into 4 labeled sections |
| 11 | Guest portal | GuestPortal, portal config, RSVP, lodging, schedule, wayfinding | |
| 12 | Design/asset mgmt (tables, chairs, fixtures, walls, linens, spacing) | admin/* consolidation | ✅ debounce auto-save success indicator across all asset editors |
| 13 | Decor designer + decor mgmt | DecorDesigner, AdminDecorSection, decor admin | ✅ non-blocking delete confirm; fix owner-id dup-guard inconsistency |
| 14 | Events: questions, templates, guidelines | EventQuestionsWizard, TemplateSelector, guideline admin | ✅ fix dead Templates feature (never rendered) + overwrite confirm |
| 15 | Operations: staff, timeline, vendors | StaffOperationsPanel, TimelinePanel, VendorPanel | ✅ toast for import success/error |
| 16 | Communication: direct messages, submissions | DirectMessagePanel, SubmissionStatusPanel | ✅ auto-scroll message list to newest |
| 17 | Print/export + backup UI + onboarding | PrintView, backup UI, welcome, empty states | ✅ expose Backup & Restore panel (was unreachable) |
| 18 | NEW — Event Overview dashboard | EventOverview, eventDashboard util | ✅ RSVP/capacity reconciliation, response rate, health grade, quick actions |
| 19 | Final QA sweep | whole app | ✅ CI green; removed last blocking alerts; completed resetToDefaults; no XSS; collision + auth + portal verified |

## Follow-up features delivered
- ✅ Vendor payments tracking summary → added as a **Vendor budget card** in the Event Overview (contract/paid/balance/overdue) + vendors added to backup.
- ✅ Keyboard-shortcuts help modal (was a dead Help button — no modal rendered).
- ✅ Event Overview dashboard (capacity/RSVP reconciliation + health).

## New feature candidates still open
- Guest count / seating reconciliation report (deep-dive, e.g. per-table counts).
- Layout export to image/PDF incl. guest list (PrintView covers HTML print; image/PDF export would be a follow-up).
- Onboarding / empty-state guidance for first-time users (Welcome modal exists; a guided setup flow is a larger feature).

## Deferred (documented, not implemented)
- **Deep physical merge of admin asset editors** (e.g. Chairs→Tables/Seating, Linens→Tables, Walls→Fixtures). The 15 admin tabs are already grouped into 4 labeled sections (Module 10), which delivers the main UX consolidation. Physically merging the ~800-line editor components is high-risk and would need substantial new test coverage, so it is intentionally deferred rather than done right before the final QA sweep.

## Platform (Supabase) workstream
| # | Feature | Status |
|---|---|---|
| A | Account registration + org bootstrap (multi-tenant) | ✅ built + tested |
| B | Data repository seam (local + Supabase providers) + layout sync | ✅ built + tested |
| C | From-scratch go-live guide & architecture (docs/platform/PLATFORM.md) | ✅ written |
| D | Wire repository into app UI (useLayoutState → repository when enabled) | ✅ built + tested: org id in auth, layoutSync service + useLayoutBackendSync hook, save/delete flush to backend |
| E | Real-time layout collaboration (Supabase Realtime) | ✅ built + tested: org-scoped layouts channel in useLayoutBackendSync |
| F | Server-side guest portal auth + RSVP | ✅ built + tested: token-verified identity RPC + secure RSVP RPC (migration 0002), backend seam + wired into GuestPortal |
| G | Object storage for images | ✅ built + tested: imageStorage seam (local data-URL / Supabase bucket), SafeImage resolves signed URLs, uploads wired into MultiImageUpload + AdminPanel |
| H | Extend repository to venues/guests/vendors/staff/decor | ✅ built + tested: generic org_data repository (migration 0003) + entitySync + useEntityBackendSync, wired into AuthenticatedApp |
| I | Multi-org invites via email | ⏳ ready to wire |
