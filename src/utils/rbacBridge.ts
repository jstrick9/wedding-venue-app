import type { User, UserPermissions } from '../types';
import { PERMISSIONS } from '../constants/permissions';

/**
 * RBAC ↔ permission bridge.
 *
 * Reconciles the two RBAC systems:
 *  - System A (`permissions.ts`) enforces coarse `UserPermissions` flags +
 *    `User.role`.
 *  - System B (`useRBAC` + `PERMISSIONS`) is a granular role/permission
 *    registry edited in the Access Control panel.
 *
 * A user may have an assigned RBAC role (`user.assignedRoles`). This bridge
 * derives the coarse `UserPermissions` flags from that role's granular
 * permissions (including inherited permissions), so granular toggles in the
 * Access Control panel actually take effect at the enforcement layer.
 *
 * Explicit `user.permissions` always win over role-derived defaults, so admins
 * can still hand-tune a user.
 */

interface RbacRole {
  id: string;
  permissions: string[];
  inheritsFrom?: string[];
}

const ROLES_KEY = 'spm_rbac_roles';

function readRoles(): RbacRole[] {
  try {
    const raw = localStorage.getItem(ROLES_KEY);
    const roles = raw ? JSON.parse(raw) : [];
    return Array.isArray(roles) ? (roles as RbacRole[]) : [];
  } catch {
    return [];
  }
}

/** All granular permission ids for a role, including inherited roles. */
export function getRolePermissionIds(roleId: string): string[] {
  const roles = readRoles();
  const collected = new Set<string>();
  const visit = (id: string) => {
    const role = roles.find((r) => r.id === id);
    if (!role || collected.has(`role:${id}`)) return;
    collected.add(`role:${id}`);
    (role.inheritsFrom || []).forEach(visit);
    role.permissions.forEach((p) => collected.add(p));
  };
  visit(roleId);
  return Array.from(collected).filter((x) => !x.startsWith('role:'));
}

/** Map a granular permission id to the coarse UserPermissions flag it implies. */
const PERMISSION_TO_FLAG: Record<string, keyof UserPermissions> = {
  'layout.canvas.edit': 'canEditLayout',
  'layout.canvas.view': 'canViewLayout',
  'guests.manage': 'canManageGuests',
  'export.print': 'canPrint',
  'export.download': 'canExport',
  'templates.create': 'canCreateTemplates',
  'templates.manage': 'canEditTemplates',
  'templates.delete': 'canDeleteTemplates',
  'admin.users.manage': 'canInviteUsers',
  'admin.users.invite': 'canInviteUsers',
  'layout.view.all': 'canViewAllLayouts',
};

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

/**
 * Resolve the effective coarse permission flags for a user.
 *
 * When a user has an assigned RBAC role, that role is authoritative for the
 * mapped flags: a mapped permission present in the role grants the flag, and a
 * mapped permission absent from the role denies it (so removing a permission in
 * the Access Control panel actually revokes it). Explicit `user.permissions`
 * always override role-derived values. Users without an assigned role keep the
 * legacy default behavior (only explicit permissions apply).
 */
export function resolveUserPermissions(user: User | null | undefined): UserPermissions {
  const explicit = user?.permissions || {};
  const roleIds = user?.assignedRoles || [];
  if (roleIds.length === 0) return explicit;

  const ids = getUserPermissionIds(user);
  const idSet = new Set(ids);

  // Start with every mapped flag denied, then grant those present in the role.
  const derived: UserPermissions = {
    canViewLayout: idSet.has('layout.canvas.view'),
    canEditLayout: idSet.has('layout.canvas.edit'),
    canManageGuests: idSet.has('guests.manage'),
    canPrint: idSet.has('export.print'),
    canExport: idSet.has('export.download'),
    canCreateTemplates: idSet.has('templates.create'),
    canEditTemplates: idSet.has('templates.manage'),
    canDeleteTemplates: idSet.has('templates.delete'),
    canInviteUsers: idSet.has('admin.users.manage') || idSet.has('admin.users.invite'),
    canViewAllLayouts: idSet.has('layout.view.all'),
  };

  // Admin/staff roles implicitly grant broad access via their hierarchy.
  if (idSet.has('admin.panel.access')) {
    derived.canEditLayout = true;
    derived.canManageGuests = true;
    derived.canPrint = true;
    derived.canExport = true;
    derived.canViewLayout = true;
  }
  if (idSet.has('staff.operations.access')) {
    derived.canManageGuests = true;
  }

  // Explicit user.permissions override role-derived values.
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
