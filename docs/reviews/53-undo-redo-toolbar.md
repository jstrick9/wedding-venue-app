# Review 53 — Render the (previously dead) Undo/Redo toolbar

`UndoRedoToolbar` was a fully-implemented floating toolbar reading `useUndoRedo`
(canUndo/canRedo/undo/redo/historyLength), but it was never rendered — undo/redo were
only reachable via Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z keyboard shortcuts, which is
undiscoverable for most users.

**Fix:** rendered `<UndoRedoToolbar />` over the canvas inside the `UndoRedoProvider`
(bottom-center; the bottom-left holds the capacity/overview controls and top-center the
collision warnings, so there is no overlap). This makes undo/redo visible and clickable
while keeping the keyboard shortcuts.

## Validation
- `npm run typecheck` clean; `npx tsc --noEmit --noUnusedLocals` clean.
- `npx vitest run`: 312 passed / 11 skipped.
- `npm run build` green.
