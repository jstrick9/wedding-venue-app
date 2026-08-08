# 137 — Design Studio: clear undo history when the layout is replaced

## Bug
`UndoRedoContext.clearHistory()` existed but was **never called**. The undo/redo
stack therefore survived venue switches, saved-layout loads, and template loads —
so pressing Undo after switching venues could restore a **different venue's**
layout (a data-integrity / user-confusion bug).

## Fix
- Added a typed `spm_clear_undo_history` event to the app-event bus.
- `useLayoutState` now emits it whenever it replaces the working layout:
  `changeVenue`, `loadLayout`, and `loadTemplate`.
- `UndoRedoContext` subscribes to it and calls `clearHistory()` (clears both past
  and future), so Undo/Redo start fresh for the newly loaded layout.

## Tests
- `src/utils/appEvents.test.ts` (+1): the `spm_clear_undo_history` event delivers
  to typed subscribers (the mechanism the undo provider uses).

## CI
593 passing / 11 skipped (was 592). Typecheck, event-bus lint, unused-locals, and
single-file build all green.

## Files
- `src/utils/appEvents.ts`
- `src/hooks/useLayoutState.ts`
- `src/contexts/UndoRedoContext.tsx`
- `src/utils/appEvents.test.ts`
