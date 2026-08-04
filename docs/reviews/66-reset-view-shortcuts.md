# Review 66 — Implement the advertised reset-view keyboard shortcuts

The Sidebar Settings tab's "Reset View" buttons show `title` tooltips advertising
**Ctrl+1** (fit venue) and **Ctrl+0** (fit canvas), but the global keydown handler did
not implement them — the tooltips were misleading.

**Fix:** added `Ctrl/Cmd+1` → `handleResetToVenue()` and `Ctrl/Cmd+0` →
`handleResetToCanvas()` to the `AuthenticatedApp` global keydown handler (the same
handler that runs the duplicate/properties/help shortcuts), and added both to the
WorkspaceHelp shortcut list so the guide, tooltips, and behavior are consistent.

## Validation
- `npm run typecheck` clean; build green (~1.34 MB / ~304 KB gzip).
- `npx vitest run`: 325 passed / 11 skipped.
