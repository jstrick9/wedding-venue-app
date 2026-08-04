# Re-Review — Admin module code hygiene (dead imports)

## Finding
Every admin sub-component (Branding, Chair, Decor, Fixture, Guideline, Linen,
Spacing, Table, Template, User, Venue, Wall) imported `AdminSubmissionQueue` and
`AdminDecorSection`, but:
- `AdminSubmissionQueue` is only rendered in `UserManagement`.
- `AdminDecorSection` is only rendered in `AdminPanel` and `DecorManagement`.

The imports were **dead** in 11 files each (22 total) — bundle bloat, misleading
coupling, and circular-import risk.

## Fix
Removed the unused imports from all admin sub-components where the component
isn't actually rendered. `UserManagement` (AdminSubmissionQueue) and
`DecorManagement`/`AdminPanel` (AdminDecorSection) keep their imports.

## Also fixed
- `rbacBridge.test.ts` `makeUser` helper returned an object not assignable to
  `User` (latent typecheck error). Now returns a properly-typed `User`.

## Validation
- Typecheck clean; full suite **307 / 11 skipped**; build succeeds.
