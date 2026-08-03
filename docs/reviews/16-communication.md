# Module Review — 16: Communication (Direct Messages, Submissions)

**Scope:** `src/components/DirectMessagePanel.tsx`, `src/components/SubmissionStatusPanel.tsx`, `src/hooks/useDirectMessages.ts`, `src/hooks/useSubmissionWorkflow.ts`

## Findings

### UX (Minor) — Message list did not auto-scroll to the newest message
`DirectMessagePanel` rendered messages in a fixed-height scrollable box but never scrolled to the bottom on new messages, so in a long thread the newest message could sit below the fold.
**Fix:** Added a ref + effect that scrolls the list to the bottom whenever the thread or thread-id changes.

## Verified-good (no change)
- `useDirectMessages` trims and rejects empty messages; Enter-to-send with `preventDefault`.
- `useSubmissionWorkflow` uses versioned storage (consistent with the Module 1 backup/restore fix) and supports `approve` / `request_changes` / `reject`.
- `SubmissionStatusPanel` surfaces status (approved / changes-requested / rejected).

## Cross-module impact
- `DirectMessagePanel` only (added `useRef`/`useEffect` import + ref).

## Validation
- Typecheck clean; `useDirectMessages` tests pass; full suite **263 passed / 11 skipped**; build succeeds.
