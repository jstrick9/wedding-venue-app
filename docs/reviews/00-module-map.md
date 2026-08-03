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
| 12 | Design/asset mgmt (tables, chairs, fixtures, walls, linens, spacing) | admin/* consolidation | |
| 13 | Decor designer + decor mgmt | DecorDesigner, AdminDecorSection, decor admin | |
| 14 | Events: questions, templates, guidelines | EventQuestionsWizard, TemplateSelector, guideline admin | |
| 15 | Operations: staff, timeline, vendors | StaffOperationsPanel, TimelinePanel, VendorPanel | |
| 16 | Communication: direct messages, submissions | DirectMessagePanel, SubmissionStatusPanel | |
| 17 | Print/export + backup UI + onboarding | PrintView, backup UI, welcome, empty states | |
| 18 | NEW — Event Overview dashboard | EventOverview, eventDashboard util | ✅ RSVP/capacity reconciliation, response rate, health grade, quick actions |

## New feature candidates (Intelligence Platform additions)
- Dashboard: capacity vs RSVP reconciliation, event health score.
- Vendor payments tracking summary.
- Guest count / seating reconciliation report.
- Layout export to image/PDF incl. guest list.
- Onboarding / empty-state guidance for first-time users.
- Keyboard-shortcuts help modal.
