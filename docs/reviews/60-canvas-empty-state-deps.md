# Review 60 — Canvas empty-state onboarding hint + dev-dependency vulnerability fix

## 1. Canvas had no empty-state guidance (UX gap)
When a new user opened an empty layout, the canvas was a blank gray area — the only
onboarding was the WelcomeModal tour (dismissible). There was no in-context cue about
how to start.

**Fix:** added an empty-state onboarding card overlaid on the canvas whenever there are
no tables, fixtures, or decor placed (and not mid-drag). It reads: "Let's build your
layout — drag a table, fixture, or decor item from the left sidebar onto this canvas to
get started, or click an item then click on the canvas to place it." It disappears as
soon as the first item is placed.

## 2. Dev-tooling vulnerabilities (hygiene)
`npm audit` reported 5 issues (babel, esbuild, postcss, undici, vite) — all in
dev/build tooling, not the shipped single-file app. Ran `npm audit fix`, which updated
transitive dev deps (package-lock only; direct deps unchanged) and dropped the count to
**0 vulnerabilities**. Verified build + typecheck + full suite remain green.

## Validation
- `npm run typecheck` clean; build green (~1.33 MB / ~302 KB gzip); lint clean.
- `npx vitest run`: 325 passed / 11 skipped.
- `npm audit`: 0 vulnerabilities (was 5).
