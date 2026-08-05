# Review 88 — Continued gap pass round 10

Autonomous bug-hunt and UI/UX improvement pass. Three findings fixed, each
CI-validated and committed to `main`.

## 1. GPS coordinate validation on wayfinding points
Lat/lng were accepted without validation, so a bad value (e.g. lat 999) produced
a broken "Open in Maps" link. Now latitude must be -90..90, longitude -180..180,
and both must be entered together (or both blank).

## 2. Richer manual weather forecast entry
The manual forecast form only captured a condition, so temperature and rain
chance (which the guest portal displays) could only come from the auto-fetch.
Added low/high temp and rain-chance fields with validation (low ≤ high, rain
0–100) and an explicit Add button.

## 3. Forecast list shows low–high temperature range
The venue's forecast list showed only the high temperature; now it shows the full
low–high range (e.g. "62°–78°").

## CI
All commits green: `npm run typecheck`, `npm run lint:events`, `npx vitest run`,
`npm run build`. Full suite: **394 passing / 11 skipped**.
