# Review #195 — Staff login “or” divider and branded browser tabs

Platform and venue staff login still showed an unused **or** divider. Signing
out of the platform console left `#/platform-admin/branding` in the URL, and the
browser tab stayed **Seven Paths Manor** instead of Platform → Branding (name
and logo). Venue, couple, and guest surfaces had the same tab problem.

## 1. What changed

- Hide the **or** divider on platform and venue staff login (`showPublicPortalLinks={false}`)
- Sign-out from `#/platform-admin/…` returns to `#/platform-login`
- Venue workspace sign-out returns to `#/venue-login/<slug>` when a slug is known
- Browser tab title, favicon, and theme color follow the active branding:
  platform console/login, venue workspace, couples portal, guest portal
- Initial `index.html` title/favicon/splash use the platform default, not Seven Paths Manor

## 2. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **838 passed / 5 skipped** |
| `npm run build` | Pass — 2,288.30 kB / 545.18 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #195.*
