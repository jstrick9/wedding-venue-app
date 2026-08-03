# Module Review 04 — Authentication & RBAC

**Scope:** `src/utils/auth.ts`, `src/contexts/AuthContext.tsx`, `src/utils/permissions.ts`, `src/hooks/useRBAC.ts`, `src/constants/permissions.ts`, `src/types/rbac.ts`, `src/components/LoginScreen.tsx`, `src/components/PasswordReset.tsx`, `src/components/ForcePasswordChange.tsx`, `src/components/admin/AccessControlPanel.tsx`, `src/components/admin/UserManagement.tsx`.

## Summary

The local auth layer is genuinely strong: PBKDF2‑SHA256 hashing, per‑user salt, timing‑safe comparison, session versioning, persisted lockout, session TTL, forced password change (added earlier). The main remaining issues are the persistence of a plaintext bootstrap password and a deep split between the two permission systems.

## Findings

### P2 — Default admin password was stored in plaintext at rest
`defaultUsers` shipped `password: 'REPLACE_ON_FIRST_LOGIN'` as a plaintext field. Although `requiresPasswordChange` (now enforced) gates the workspace, a plaintext credential should never be persisted even for a bootstrap account.
**Fix:** Pre‑hashed the bootstrap password with the app's own PBKDF2‑SHA256 (120k iterations) and stored only `passwordHash`/`passwordSalt` with `password: ''`. Added tests proving (a) no default user has a plaintext password and (b) the bootstrap admin authenticates against the stored hash.

### P2 — Hardcoded lockout threshold duplicated the auth constant
`LoginScreen` hardcoded `5` for "remaining attempts before lockout" while `auth.ts` defines `MAX_FAILED_LOGINS = 5`. If the policy changed, the message would drift.
**Fix:** Exported `MAX_FAILED_LOGINS` from `auth.ts` and used it in `LoginScreen`.

## Findings (documented, deferred — not changed)

### P1 — Dual RBAC systems; the role-permission editor is not the enforcement mechanism
There are two parallel access-control models:
1. **Legacy (enforced):** `user.role` (`admin`/`staff`/`basic`/`guest`) + `user.permissions` boolean flags (`canEditLayout`, `canManageGuests`, …), read by `src/utils/permissions.ts` throughout the app.
2. **RBAC registry (presentational):** `useRBAC`/`PERMISSIONS`/`Role` with a hierarchical permission registry, audit log, and role templates, managed in the Access Control panel.

When an admin assigns an RBAC role to a user, `UserManagement` maps role **hierarchy → `user.role`** (≥90 admin, ≥40 staff, guest, else basic), so coarse access does change. **However, the role's fine-grained permission list is not propagated to `user.permissions`, and `permissions.ts` never consults the role registry.** Consequence: two users with the same app-role but different custom roles are treated identically by the app's gating; editing a role's permission checkboxes in Access Control has no effect on what that user can actually do.

This is a real incomplete feature. A correct fix is a dedicated workstream (build a mapping from RBAC permission IDs → the legacy flags the app reads, and re-sync on role assignment). It was **deferred** here because a half-fix risks locking users out of features mid-migration; the affected files and a recommended approach are captured above. In the meantime, admins can still set per-user `user.permissions` flags directly in User Management.

## Cross-module dependencies affected
- **Login** — bootstrap admin now authenticates via hash; forced-change gate unchanged.
- **Access Control / User Management** — documented gap only; no behavioral change.
- **Backup/restore** — exported user records now carry hashed (not plaintext) bootstrap passwords.

## Validation
- Typecheck clean.
- Added auth tests (no-plaintext seed + hash verification).
- Full suite: **244 passed / 11 skipped** (was 242).
- Production build succeeds.

## Recommendation (follow-up workstream)
Introduce a single `hasPermission(user, permissionId)` helper that consults the RBAC role registry (with hierarchy + inheritance) and have `permissions.ts` delegate to it, while retaining the legacy flags as a fallback for existing users. Add migration to backfill `user.permissions` from the assigned role. Cover with role-matrix tests.
