# Review 125 — Couples portal: set/change/remove a guest portal password

## What
The guest portal supports an optional entry password (`portalPassword` /
`portalPasswordHash`), but the couple's **Portal Settings** had no way to set,
change, or remove it — it was only seeded from the (removed) venue config.

## Change
- Added a **Portal password (optional)** field to the couple's Portal Settings.
  Setting one hashes it via `createSecretRecord` and stores `portalPasswordHash` +
  `portalPasswordSalt` (clearing the plaintext). A **"Remove the password"** toggle
  clears it. Empty keeps the current password.
- Since couples now own their guest portal, this closes the gap where guests had to
  use a password the couple couldn't control.

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**482 passing / 11 skipped / 124 files**), `npm run build` all green.
