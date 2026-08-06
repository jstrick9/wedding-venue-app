# Review 107 — B5: align the shared UI kit to the venue brand

## What
Fixed a platform-wide visual inconsistency: the A5 design system's `primary` tone
used Tailwind **indigo**, while the rest of the app (CenteredModal header,
ConfirmDialog confirm, TemplateSelector active, config `primaryColor`) uses the
**purple brand** `#4A1942`.

## Changes
- `src/components/ui/index.tsx` — `Button` primary → `bg-[#4A1942] hover:bg-[#3b1435]`;
  `Badge` primary → `bg-[#4A1942]/10 text-[#4A1942]`; `inputCls` focus ring/border →
  `#4A1942`.
- `StudioLayoutsHome.tsx` — "Open in editor" button and current-space ring now the
  brand purple.
- `VenueDashboard.tsx` — "Design Studio" button now the brand purple.

New surfaces therefore match the existing admin/studio/portal brand instead of
introducing a second accent color.

## Tests / CI
Color-only changes. Full suite **467 passing / 11 skipped / 122 files**;
`npm run typecheck`, `npm run lint:events`, `npm run build` all green.
