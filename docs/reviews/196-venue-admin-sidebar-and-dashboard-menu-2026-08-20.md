# Review #196 — Venue dashboard Menu overlay and Admin sidebar console

Partial windows showed a **☰ Menu** hamburger on top of the Venue Portal
landing sidebar. Admin & System Settings still stacked four chrome rows of
pills for ~20 settings, which made the venue-admin persona hunt instead of
navigate.

## 1. What changed

- Removed the overlay hamburger (`Toggle navigation menu`) from
  `VenueDashboard.tsx`. The Home sidebar stays on screen and still collapses
  to icons; it is no longer an off-canvas drawer.
- Rebuilt Admin & System Settings as a dark grouped left sidebar (same
  language as the platform console): Overview plus the five existing
  categories with nested sections.
- Dropped the four-row pill toolbar. Overview is the landing page with KPI
  shortcut cards (`Venues:`, `Seating:`, …). Search, Templates / Checklists /
  Security, and ← Dashboard live in a thin header.
- Hash routes: `#/admin` = overview, `#/admin/venues`, `#/admin/branding`,
  etc. (`src/utils/venueAdminRoute.ts`). Dashboard `onOpenAdmin(tab)` writes
  the matching hash.

Design Studio `Header.tsx` **☰ Menu** is unchanged.

## 2. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **845 passed / 5 skipped** |
| `npm run build` | Pass — 2,287.83 kB / 545.45 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #196.*
