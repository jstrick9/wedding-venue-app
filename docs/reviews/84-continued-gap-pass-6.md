# Review 84 — Continued gap pass round 6

Autonomous bug-hunt and UI/UX improvement pass. Three findings fixed, each
CI-validated and committed to `main`.

## 1. Venue unread-chat badge stays current
The venue's unread-chat badge was computed once and went stale when new couple
messages arrived while the venue was on the Couples admin but not inside an open
chat pane. Added a light 5s poll so the badge stays current.

## 2. Cocktail space recommendation used the wrong category key
Both category-derivation functions (`deriveRecommendedVenueCategories` in
`coupleService` and the wizard's `deriveVenueCategories`) emitted `'cocktail-hour'`,
but venues use `'cocktail'` (the `LayoutCategory` type). So a couple answering
they need a cocktail-hour space never got cocktail venues recommended, and the
wizard's "Show all layouts" filter missed cocktail venues. Normalized to
`'cocktail'` in both + a test.

## 3. Venue collaborator invite-link copy double-encoded the URL
CoupleManagement copied a collaborator's invite link by passing the already-built
`portalUrl(...)` into `handleCopy`, which wrapped it again → a broken
double-encoded token (`portalUrl(portalUrl(token))`). Now passes the raw token.

## CI
All commits green: `npm run typecheck`, `npm run lint:events`, `npx vitest run`,
`npm run build`. Full suite: **394 passing / 11 skipped**.
