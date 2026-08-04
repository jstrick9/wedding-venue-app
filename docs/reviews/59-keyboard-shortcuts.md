# Review 59 — Make advertised keyboard shortcuts actually work

The Sidebar **Tips** section advertised three shortcuts that did nothing: "Ctrl/Cmd + D
duplicates item", "P toggles properties panel", and "? opens the shortcut guide". The
global keydown handler only handled Delete/Backspace and Escape, so the tips were
misleading.

**Fix:** extended the `AuthenticatedApp` global keydown handler to implement the
promised shortcuts (undo snapshot is pushed before a duplicate so it's undoable):
- `Ctrl/Cmd + D` → duplicate the selected item
- `P` → toggle the properties panel
- `?` → open the workspace shortcut guide

Also added these entries to the WorkspaceHelp shortcut list so the guide and tips are
consistent and accurate.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 325 passed / 11 skipped.
