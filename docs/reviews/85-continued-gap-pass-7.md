# Review 85 — Continued gap pass round 7

Autonomous bug-hunt and UI/UX improvement pass. Four findings fixed, each
CI-validated and committed to `main`.

## 1. Chat timestamps
Chat messages in both the couple portal and the venue admin showed sender + side
but no time. Added a compact time-of-day timestamp to each message bubble in both
panes.

## 2. No duplicate "Entrance" in guest wayfinding From select
If the venue drew an entry point labeled "Entrance", the From dropdown showed two
"Entrance" options. Now a map point already labeled "Entrance" is skipped (the
hardcoded Entrance already represents it).

## 3. Couple guest CSV export includes RSVP details
The guest-list export only contained name/email/phone. Now it includes RSVP status,
meal, plus-one, and dietary notes when RSVPs are available, so the couple doesn't
have to open each guest to see who's attending and their meal.

## 4. Couple Overview shows weather forecast
The venue can enter a forecast per event day, but the couple never saw it (only
the guest portal schedule did). Now the couple's Overview shows a weather summary
for their event dates, helping them plan outdoor spaces and rain contingencies.

## CI
All commits green: `npm run typecheck`, `npm run lint:events`, `npx vitest run`,
`npm run build`. Full suite: **394 passing / 11 skipped**.
