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
| 20 | Platform QA sweep | platform workstream (A–I) | ✅ CI green; fixed guest-portal server identity wiring, RSVP token carry, realtime channel churn, listener re-registration |

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
| I | Multi-org invites via email | ✅ built + tested: org_invites migration (0004) + accept RPC, inviteService (local + Supabase + email), InviteMembers admin tab + AcceptInvite route |

## Fresh full re-review (pass 2) — status
| # | Module | Finding / fix |
|---|---|---|
| 01 | Data & persistence | resetToDefaults now writes versioned keys in envelope format (M21) |
| 08 | Layout canvas | capacity counter honors customCapacity + seating rows (M22) |
| 18 | Event Overview | use STORAGE_KEYS instead of hardcoded keys (M23) |
| app shell | saved-layouts dropdown refreshes on same-tab data change (M24) |

## Pass 2 (fresh full re-review) — complete
✅ Full re-audit done; findings 21–30 fixed & committed (data reset, capacity
counters, storage-key constants, stale-UI refresh, timelines data-safety,
portal-guest provisioning, vendor-payments UI, guest-portal date-safety).
See docs/reviews/31-pass2-summary.md.

## Autonomous gap pass — round 2 (dead edit features + dead-code sweep)
✅ Fixed 3 "wired but never rendered" bugs (image-preview lightbox, vendor Edit,
password-reset expiry countdown), added timeline event editing (missing feature),
applied permission gates to Guests/Print modals, removed dead `DatabaseService.ts`,
and swept ~20 unused vars/imports (found via `tsc --noUnusedLocals`).
See docs/reviews/50-dead-edit-features.md.

## Autonomous gap pass — round 3 (enable grid & snap + more dead code)
✅ Enabled the fully-implemented-but-hidden Grid & Snap feature (was hardcoded off with
no-op Sidebar handlers; now state-backed with a Sidebar "Grid & Snap" card), removed 7
dead data setters (venueData) and 8 dead permission helpers (permissions.ts).
See docs/reviews/51-grid-snap-enable.md.

## Autonomous gap pass — round 4 (Event Overview access gating)
✅ Event Overview "Manage Guests" quick action now hidden when the user lacks
canManageGuests (was shown to everyone but the gated modal no longer opened).
See docs/reviews/52-overview-access-gating.md.

## Autonomous gap pass — round 5 (visible Undo/Redo toolbar)
✅ Rendered the previously-dead UndoRedoToolbar over the canvas — undo/redo were only
reachable via keyboard shortcuts before. See docs/reviews/53-undo-redo-toolbar.md.

## Autonomous gap pass — round 6 (decor starter catalog)
✅ Wired dead defaultDecorCategories/defaultDecorItems as first-use seeds — new users
now get a starter decor catalog instead of empty (explicitly-saved data never
overwritten). Removed dead legacy chair-spec functions.
See docs/reviews/54-decor-starter-catalog.md.

## Autonomous gap pass — round 7 (branding hover/translucency + loading screen)
✅ Custom brand color now applies to hover/active states and translucency variants
(color-mix preserves alpha); replaced bare "Loading…" text with a branded LoadingScreen.
See docs/reviews/55-branding-hover-loading.md.

## Autonomous gap pass — round 8 (polished ConfirmDialog)
✅ Replaced native window.confirm() across panels with an accessible, on-brand
ConfirmDialog (delete vendor/timeline/task/area/shift/question/room + template
overwrite + import merge). See docs/reviews/56-confirm-dialog.md.

## Autonomous gap pass — round 9 (action feedback toasts)
✅ Added success toasts for layout save, saved-layout delete, and guest CSV export
(these actions previously gave no confirmation). See docs/reviews/57-action-feedback-toasts.md.

## Autonomous gap pass — round 10 (Escape closes panel modals)
✅ Pressing Escape now closes open panel modals (ModalProvider global handler), with a
shared flag so ConfirmDialogs own Escape and don't double-close the panel underneath.
See docs/reviews/58-escape-to-close.md.

## Autonomous gap pass — round 11 (working keyboard shortcuts)
✅ Implemented the shortcuts the Tips/help advertised but didn't implement
(Ctrl/Cmd+D duplicate, P properties, ? help) + kept the guide in sync.
See docs/reviews/59-keyboard-shortcuts.md.

## Autonomous gap pass — round 12 (canvas empty state + deps)
✅ Added an in-canvas onboarding hint for empty layouts; fixed 5 dev-tooling
vulnerabilities (npm audit 5→0). See docs/reviews/60-canvas-empty-state-deps.md.

## Autonomous gap pass — round 13 (icon-button accessibility)
✅ Added aria-labels to icon-only close/remove buttons across GuestPanel, LodgingBuilder,
AccessControlPanel, and StaffOperationsPanel. See docs/reviews/61-icon-button-a11y.md.

## Autonomous gap pass — round 14 (layout duplicate-name warning)
✅ The Save Layout modal now warns inline when the typed name matches an existing saved
layout. See docs/reviews/62-layout-duplicate-warning.md.

## Autonomous gap pass — round 15 (persist UI preferences)
✅ Sidebar width/collapsed and grid/snap settings persist across sessions via a new
spm_ui_prefs storage key. See docs/reviews/63-ui-prefs-persist.md.

## Autonomous gap pass — round 16 (helpful Load empty state)
✅ The Load Layout modal now guides users to Save Layout when they have no saved layouts.
See docs/reviews/64-load-empty-state.md.

## Autonomous gap pass — round 17 (Admin Panel UX)
✅ Venue Management gains a live name-search + "no matches" empty state; the Admin Panel
remembers the last-visited section. See docs/reviews/65-admin-panel-ux.md.

## Autonomous gap pass — round 18 (reset-view shortcuts)
✅ Implemented Ctrl/Cmd+1 (fit venue) and Ctrl/Cmd+0 (fit canvas) advertised in the
Settings tab tooltips; synced the WorkspaceHelp guide. See docs/reviews/66-reset-view-shortcuts.md.

## Autonomous gap pass — round 19 (guest portal preview)
✅ Added a "Preview Portal" button to the Guest Portal admin hero so admins can see how
the configured portal will look to guests. See docs/reviews/67-guest-portal-preview.md.

## Autonomous gap pass — round 20 (clear-layout confirm)
✅ Replaced the last native confirm() in the main workspace flow ("Clear All Items")
with the reusable ConfirmDialog. See docs/reviews/68-clear-layout-confirm.md.

## Autonomous gap pass — round 21 (dismissible layout warnings)
✅ The canvas layout-warning banner is now dismissible; it reappears only when the set
of warnings changes. See docs/reviews/69-dismissible-warnings.md.

## Autonomous gap pass — round 22 (over-capacity warning)
✅ Over-capacity tables in the guest assignments view are now flagged red with a
"Over capacity by N" label (previously shown as green/full). See docs/reviews/70-overcapacity-warning.md.

## Autonomous gap pass — round 23 (configurable meal options)
✅ Guest RSVP meal choices are now configurable in the Guest Portal admin (with sensible
defaults), and the guest/plus-one selects render the configured options.
See docs/reviews/71-configurable-meal-options.md.

## Autonomous gap pass — round 24 (master-layout toasts)
✅ Save/clear master layout now show success toasts (previously no feedback).
See docs/reviews/72-master-layout-toasts.md.

## Autonomous gap pass — round 25 (RSVP meal label)
✅ The RSVP confirmation now shows the configured meal label (not the stored value).
See docs/reviews/73-rsvp-meal-label.md.

## RBAC reconciliation (deep review)
✅ System A (enforcement) now consults System B (assigned RBAC role granular permissions) via utils/rbacBridge.ts — Access Control toggles take effect. See docs/reviews/36-rbac-reconciliation.md.

## Autonomous gap pass — status
✅ Removed 3 dead modules (DecorManagement, useHistory, useAppModals + test) —
verified no references; cleaned a stale smoke-test comment.
✅ Reviewed builders (CustomVenueBuilder + LodgingBuilder) in depth; hardened
CustomVenueBuilder and wired in the previously-dead LodgingBuilder (previous
commit a4def88).
See docs/reviews/39-builders-rereview.md + 40-deadcode-cleanup.md.
