# Review 67 — Add a "Preview Portal" button to the Guest Portal admin

The Guest Portal Configuration admin section let you edit settings but offered no way
to see the result without navigating manually.

**Fix:** added a **👁️ Preview Portal** button in the section's hero that navigates to
the `#/guest-portal` route so an admin can immediately preview how the configured portal
will look to guests. The guest portal's "← Back to Login" exits back to the app.

## Validation
- `npm run typecheck` clean; build green (~1.34 MB / ~305 KB gzip).
- `npx vitest run`: 325 passed / 11 skipped.
