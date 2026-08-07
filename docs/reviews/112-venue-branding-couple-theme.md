# Review 112 — Venue brand into the couple portal; per-couple guest portal theming

Implements the user's branding directive: the venue brand should tie through to the
couple-facing surfaces by default, but each couple can brand their **own** guest
portal.

## 1. Couples Portal → venue brand
The Couples Portal previously used Tailwind's `indigo` accent, so the couple saw a
different color than the venue team. All interactive accents (tabs, buttons, active
states, links) now use the venue brand purple `#4A1942`, matching the dashboard /
studio / admin surfaces. (`bg-indigo-600`→brand, `text-indigo-600`→brand, etc.)

## 2. Per-couple guest portal theming
- Added `themeColor?: string` to `GuestPortalConfig`.
- The Couples Portal's **Portal Settings** gained a **Theme color** picker
  (color input + hex field + reset), with a hint to leave blank to use the venue's
  brand color.
- The Guest Portal computes an accent via CSS variables
  (`--accent` / `--accent-dark` / `--accent-light`) from the couple's `themeColor`
  (validated hex), **falling back to the venue's `primaryColor`** when unset. All
  interactive elements (nav, RSVP buttons, submit, day picker, links, focus rings)
  use these variables, so a blush/pink couple theme flows everywhere in their portal.
  Invalid hex values are ignored (falls back to venue brand) so it never crashes.
- "Portal personalized" progress now also completes when the couple sets a theme.

## Other fixes in this round
- **Venue calendar event form validation** (`b8700ab`): empty title/date and
  end-before-start now show an inline error instead of silently doing nothing.
- **Guest search + RSVP filter** (`5ae9f24`): the couple's guest list gained a
  search box and All / Attending / Not attending / No-response filter pills for
  large weddings.

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**478 passing / 11 skipped / 123 files**), `npm run build` all green.
