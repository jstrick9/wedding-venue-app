import type { User, UserPermissions } from '../types';
import { PERMISSIONS } from '../constants/permissions';
import { canonicalizeRoleId, DEFAULT_ROLES } from '../constants/rbacDefaults';
import { STORAGE_KEYS } from '../constants/storageKeys';

/**
 * RBAC ↔ permission bridge.
 *
 * One authority: the granular `PERMISSIONS` / role registry. Coarse
 * `UserPermissions` flags are derived from assigned roles (including
 * inherited roles and Supabase app_role aliases). Explicit `user.permissions`
 * still override the derived flags so an admin can hand-tune a single user.
 *
 * Users with no assigned role keep the legacy `User.role` short-circuit
 * behavior in `permissions.ts`.
 */

interface RbacRole {
  id: string;
  permissions: string[];
  inheritsFrom?: string[];
  isImmutable?: boolean;
}

function readStoredRoles(): RbacRole[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RBAC_ROLES);
    const roles = raw ? JSON.parse(raw) : [];
    return Array.isArray(roles) ? (roles as RbacRole[]) : [];
  } catch {
    return [];
  }
}

/** Merge stored roles on top of the canonical system defaults. */
export function readMergedRoles(): RbacRole[] {
  const merged: RbacRole[] = DEFAULT_ROLES.map((role) => ({
    id: role.id,
    permissions: [...role.permissions],
    inheritsFrom: role.inheritsFrom,
    isImmutable: role.isImmutable,
  }));
  for (const stored of readStoredRoles()) {
    const index = merged.findIndex((role) => role.id === stored.id);
    if (index < 0) {
      merged.push(stored);
      continue;
    }
    if (merged[index].isImmutable) continue;
    merged[index] = stored;
  }
  return merged;
}

/** All granular permission ids for a role, including inherited roles. Cycle-safe. */
export function getRolePermissionIds(roleId: string): string[] {
  const roles = readMergedRoles();
  const collected = new Set<string>();
  const visit = (id: string) => {
    const canonical = canonicalizeRoleId(id);
    if (collected.has(`role:${canonical}`)) return;
    collected.add(`role:${canonical}`);
    const role = roles.find((r) => r.id === canonical);
    if (!role) return;
    (role.inheritsFrom || []).forEach(visit);
    role.permissions.forEach((p) => collected.add(p));
  };
  visit(roleId);
  return Array.from(collected).filter((x) => !x.startsWith('role:'));
}

/** Read granular permission ids for a user's assigned RBAC role(s). */
export function getUserPermissionIds(user: User | null | undefined): string[] {
  if (!user) return [];
  const roleIds = user.assignedRoles || [];
  if (roleIds.length === 0) return [];
  const ids = new Set<string>();
  for (const roleId of roleIds) {
    getRolePermissionIds(roleId).forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}

export function userHasAssignedRoles(user: User | null | undefined): boolean {
  return Boolean(user?.assignedRoles && user.assignedRoles.length > 0);
}

/**
 * Resolve the effective coarse permission flags for a user.
 *
 * When a user has an assigned RBAC role, that role is authoritative for the
 * mapped flags. Explicit `user.permissions` always override role-derived
 * values. Users without an assigned role keep the legacy default behavior.
 */
export function resolveUserPermissions(user: User | null | undefined): UserPermissions {
  const explicit = user?.permissions || {};
  const roleIds = user?.assignedRoles || [];
  if (roleIds.length === 0) return explicit;

  const ids = getUserPermissionIds(user);
  const idSet = new Set(ids);

  const derived: UserPermissions = {
    canViewLayout: idSet.has('layout.canvas.view'),
    canEditLayout: idSet.has('layout.canvas.edit'),
    canManageGuests: idSet.has('guests.manage'),
    canPrint: idSet.has('export.print'),
    canExport: idSet.has('export.download') || idSet.has('export.share'),
    canCreateTemplates: idSet.has('templates.create'),
    canEditTemplates: idSet.has('templates.manage'),
    canDeleteTemplates: idSet.has('templates.manage'),
    canInviteUsers: idSet.has('admin.users.manage') || idSet.has('admin.users.invite'),
    canViewAllLayouts: idSet.has('layout.view.all'),
  };

  // Explicit user.permissions override role-derived values. Admin/staff
  // hierarchy no longer silently re-grants flags that were revoked on the role.
  return { ...derived, ...explicit };
}

/** True if the user's assigned role has the given granular permission id. */
export function hasGranularPermission(
  user: User | null | undefined,
  permissionId: string,
): boolean {
  return getUserPermissionIds(user).includes(permissionId);
}

/** True if the permission id exists in the registry. */
export function isRegisteredPermission(id: string): boolean {
  return PERMISSIONS.some((p) => p.id === id);
}
