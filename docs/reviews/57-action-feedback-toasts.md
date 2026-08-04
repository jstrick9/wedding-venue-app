# Review 57 — Add success feedback to save / export / delete actions

Several user actions gave no confirmation, leaving users unsure whether their action
succeeded:
- Saving a layout closed the modal and updated the dropdown but showed nothing.
- Deleting a saved layout gave no confirmation.
- Exporting the guest list as CSV silently downloaded a file.

**Fix:** added success toasts for:
- Layout save (`AuthenticatedApp.handleSaveLayoutWithSync` → `Layout "X" saved.`)
- Saved-layout delete (moved the backend flush out of the setState updater and added
  `Saved layout deleted.`)
- Guest-list CSV export (`GuestPanel` export button → `Guest list exported as CSV.`)

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 323 passed / 11 skipped.
