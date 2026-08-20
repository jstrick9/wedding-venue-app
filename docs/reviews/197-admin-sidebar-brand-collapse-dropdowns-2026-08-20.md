# Review #197 — Admin console sidebar branding, collapse, and section dropdowns

Venue admins needed the Admin console rail to follow branding, collapse to
icons, and hide ~20 modules behind five section dropdowns that start closed.

## 1. What changed

- Dark console sidebar keeps slate chrome; **active/hover uses venue
  `primaryColor`** and the heading font from Branding settings
- **◀ / ▶** collapses the rail to a 72px icon bar (same pattern as the
  platform console). Clicking a section icon while collapsed opens the rail
  and that dropdown
- The five groups are **independent dropdowns**, default collapsed. Hover
  `title` describes what is inside. A header click only expands/collapses;
  nested items open modules. Overview KPIs and `#/admin/<section>` hashes
  auto-expand the matching group

## 2. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **847 passed / 5 skipped** |
| `npm run build` | Pass — 2,289.90 kB / 546.15 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #197.*
