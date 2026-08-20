# Review #198 — Venue Home URL and Admin sidebar chrome parity

Venue Home lived at `#/dashboard` while the sidebar called it Home. Admin and
Design Studio returned with Dashboard wording, and Admin’s rail was a dark
console that did not match the branded, mouse-hold-resizable Home sidebar.

## 1. What changed

- Canonical venue workspace hash is **`#/home`**. Writes no longer use
  `#/dashboard`. Leftover `#/dashboard`, `#/venue`, empty, and `#/` rewrite to
  `#/home` so current sessions are not stranded
- Admin and Design Studio close controls are **`← Home`** (hash `#/home`)
- Admin sidebar matches Home chrome: white rail, logo, venue name, tagline,
  Email/Website, brand active color, ◀/▶, and mouse-hold drag-resize
  (200–450px, collapse under ~120px). Review #197 Overview + five independent
  dropdown groups are unchanged
- Design Studio `☰ Menu` is unchanged. Phase 3 was not started

## 2. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **852 passed / 5 skipped** |
| `npm run build` | Pass — 2,292.64 kB / 546.88 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #198.*
