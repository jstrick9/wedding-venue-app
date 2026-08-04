# Re-Review — Event Questions admin editor

## Finding (functional gap)
`EventQuestionsManagement` was an incomplete, `@ts-nocheck` stub:
- **`onSaveQuestions` prop didn't exist** in `AdminCommonProps` — it was
  `undefined` at runtime, so "Add Question" silently did nothing (a dead
  feature hidden by `@ts-nocheck`).
- No way to add **dropdown options** (always `options: []`), so dropdown
  questions were unusable (the wizard validates options).
- No **edit** capability, no **required** toggle, only 3 of 5 groups exposed.

## Improvement
Rewrote `EventQuestionsManagement` as a complete, type-safe editor:
- Uses the real `setEventQuestions` prop (available via `commonProps`).
- Add / **edit** / delete questions.
- All 5 groups, text / number / **dropdown** (with comma-separated options).
- **Required** toggle + validation (text required, ≥2 dropdown options).
- Removed `@ts-nocheck`.

## Validation
- Typecheck clean; full suite **301 / 11 skipped**; build succeeds.
