# Review 61 — Accessible labels for icon-only buttons

Several icon-only buttons (mostly the "✕" close / remove controls) had no
`aria-label` (or only a `title`), so screen-reader users couldn't tell what they did.

**Fix:** added descriptive `aria-label`s to the icon-only close/remove buttons in
GuestPanel (close panel, close guest editor, remove assignment), LodgingBuilder (close),
AccessControlPanel (close), and StaffOperationsPanel (close task/area/shift editors,
remove assigned staff, remove checklist item). (DecorDesigner's close button already
had one.)

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 325 passed / 11 skipped.
