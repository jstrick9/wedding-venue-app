# Module Review — 14: Events, Questions, Templates, Guidelines

**Scope:** `src/components/EventQuestionsWizard.tsx`, `src/components/TemplateSelector.tsx`, `src/components/AuthenticatedApp.tsx` (template wiring), event-question/template/guideline admin.

## Findings

### BUG-1 (Functional, High) — The Templates feature was entirely non-functional (never rendered)
`TemplateSelector` was lazy-imported, `showTemplates` was derived from the modal state, and the Header's **Templates** button called `open('templates')` — but **no `{showTemplates && <TemplateSelector …/>}` was ever rendered** in `AuthenticatedApp`. Clicking "Templates" in the header silently did nothing. Verified by searching all of `src` (the component only appears in its own test file).
**Fix:** Rendered `<TemplateSelector>` when `showTemplates` is true, wired `onSelect` to load the template (switching venue if needed + reset view) and close the modal.

### BUG-2 (UX) — Loading a template could silently overwrite unsaved work
Template selection immediately replaces the current layout. If a user had tables/fixtures/decor in progress, it was destroyed without warning.
**Fix:** When the current layout is non-empty, confirm before replacing (`window.confirm`, consistent with the existing `clearLayout` confirm pattern used elsewhere in this app).

## Verified-good (no change)
- `EventQuestionsWizard` validates required fields, integer/dropdown values, and supports conditional `workflow` questions.
- Template categories filter correctly; empty state present; accessible tabs.

## Cross-module impact
- `AuthenticatedApp` now renders a previously-dead modal. The Header already had the button; no header change needed.

## Validation
- Typecheck clean; TemplateSelector + smoke tests pass; full suite **263 passed / 11 skipped**; build succeeds.
