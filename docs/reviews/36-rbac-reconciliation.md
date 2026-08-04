# Deep review — RBAC enforcement reconciliation

## The problem (two parallel RBAC systems)
- **System A — `utils/permissions.ts`** (the **enforcement** layer): gates the
  whole app on `User.role` (`admin`/`staff`/`basic`/`guest`) + coarse
  `UserPermissions` flags.
- **System B — `useRBAC` + `PERMISSIONS` registry** (edited in the Access
  Control panel): a granular, hierarchical role/permission registry with
  inheritance and an audit log. `UserManagement` already lets admins assign an
  RBAC role to a user (`user.assignedRoles`).

The gap: **System A never consulted System B.** An admin could create/edit roles
and toggle granular permissions in the Access Control panel, but those changes
had **zero effect** on what any user could actually do — only the coarse
`user.role` (derived from role hierarchy) was enforced. Granular grants AND
revocations were cosmetic.

## Fix — `utils/rbacBridge.ts`
A self-contained bridge (reads roles from localStorage, no hook dependency) that
derives coarse `UserPermissions` flags from a user's **assigned RBAC role's
granular permissions** (including inherited ones):
- A mapped permission present in the role → **grants** the flag.
- A mapped permission absent from the role → **denies** it (role is
  authoritative, so removing a permission in the panel actually revokes it).
- Explicit `user.permissions` always **override** role-derived values.
- Users **without** an assigned role keep legacy default behavior (no change).

`permissions.ts` now calls `resolveUserPermissions(user)` in its flag lookup, so
every enforcement point (`canEditLayout`, `canManageGuests`, `canPrint`,
`canExport`, `canAccessAdminPanel`, etc.) honors the assigned role's granular
permissions. Admin/staff short-circuits are unchanged (they remain broad).

## Validation
- `rbacBridge.test.ts` (6 tests): no-role legacy, grants from role, inherited
  permissions, admin-role implicit grants, explicit override, granular check.
- Existing `permissions.test.ts` (7) still passes.
- Full suite **307 / 11 skipped** (8 new); typecheck clean; build succeeds.

## Remaining (documented, out of scope)
- Enforcement still defaults a no-role user to lenient behavior; moving fully to
  a "role-authoritative for everyone" model would be a larger change.
- The `PERMISSIONS` registry covers only the mapped flags; other granular ids
  (e.g. decor.designer.delete) are not yet surfaced as coarse flags.
