# Re-Review — Modal-Triggered Panels Audit

Systematic audit: cross-checked every `ModalType` / `showX` flag against an
actual `<Component/>` render in `AuthenticatedApp`.

## Findings — 6 dead modal-triggered panels (imported but never rendered)

Same class of bug as the Templates selector and Staff Operations panel. The
lazy component was imported, a button/event opened the modal, and `showX` was
derived — but no `{showX && <Component/>}` existed. Clicking the trigger did
nothing.

| Panel | Modal | Fix |
|---|---|---|
| **VendorPanel** | `vendors` (Header "Vendors" + `spm_open_vendors`) | Rendered `{showVendors && <VendorPanel/>}` |
| **TimelinePanel** | `timeline` (Header "Timeline" + `spm_open_timeline`) | Rendered `{showTimeline && <TimelinePanel/>}` |
| **PrintView** | `print` (Header "Print") | Rendered with venue/tables/fixtures/guests/layoutName |
| **EventQuestionsWizard** | `eventQuestions` (master-user "Questions") | Rendered in a `CenteredModal` with questions/answers/save/venue-filter |
| **SubmissionStatusPanel** | `submission` (master-user "Submit") | Rendered in a `CenteredModal`; `onSubmit` calls `submissionWorkflow.submit` |
| **Messages** | `messages` (master-user "Messages") | Rendered `DirectMessagePanel` for the master thread in a `CenteredModal` |

Added a small reusable `CenteredModal` shell for the three card-style panels
(Event Questions, Submission Status, Messages) that don't render their own
overlay.

## Verified-good (not dead)
- `Guests`, `Admin`, `Templates`, `Decor Designer`, `Overview`, `Operations`
  were already rendered.
- `DirectMessagePanel` is also used inline in `UserManagement` (not only as a
  modal).

## Cross-module impact
- Vendors, Timeline, Print, Event Questions, Submission workflow, and Messages
  are now all reachable from the UI — completing 6 previously-inaccessible
  features.

## Validation
- Typecheck clean; full suite **297 / 11 skipped**; build succeeds.
