# Review 77 — Add "Copy Portal Link" to the Guest Portal admin

Admins could preview the guest portal but had no quick way to **share** its URL with
guests — they'd have to construct the `#/guest-portal` link by hand.

**Fix:** added a **🔗 Copy Portal Link** button in the Guest Portal Configuration hero
(beside Preview Portal) that copies `origin + pathname + #/guest-portal` to the
clipboard and shows a success confirmation. Fallback shows the URL in the message if the
clipboard API isn't available.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 331 passed / 11 skipped.
