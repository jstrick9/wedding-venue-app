# Re-Review — 10: Admin Panel (fresh pass)

## Finding

### QUALITY — Hardcoded storage keys for event roles/questions
`AdminPanel` used literal strings `'spm_event_roles'` and
`'spm_event_questions'` for the event roles/questions state. They matched
`STORAGE_KEYS` (no functional bug) but create a rename-drift hazard.

**Fix:** Use `STORAGE_KEYS.EVENT_ROLES` / `STORAGE_KEYS.EVENT_QUESTIONS`.

## Validation
- Typecheck clean.
