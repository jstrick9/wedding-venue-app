# Re-Review — RBAC data backup (fresh pass)

## Finding

### GAP (data-safety) — RBAC roles/groups/audit not backed up or synced
`useRBAC` stored roles, permission groups, and the audit log under hardcoded
keys (`spm_rbac_roles`, `spm_rbac_groups`, `spm_rbac_audit`) that were **not**
`STORAGE_KEYS` constants and **not** in the backup-domain registry. So admin
customizations made in the Access Control panel were:
- missing from backup/restore,
- missing from corruption-recovery,
- missing from the Supabase entity sync.

**Fix:**
- Added `STORAGE_KEYS.RBAC_ROLES/GROUPS/AUDIT`.
- `useRBAC` uses the constants.
- Registered `rbacRoles/rbacGroups/rbacAudit` in `BACKUP_DOMAINS`,
  `BackupPayload`, and the entity-sync domains.

## Cross-module impact
- Access Control customizations (roles, permission groups, audit log) now
  survive backup/restore, recovery, and cross-device sync.

## Validation
- Typecheck clean; backup + entity-repository tests pass; full suite **299 /
  11 skipped**; build succeeds.
