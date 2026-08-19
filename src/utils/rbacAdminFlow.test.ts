import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../constants/storageKeys';

function writeRoles(roles: unknown[]): void {
  localStorage.setItem(STORAGE_KEYS.RBAC_ROLES, JSON.stringify(roles));
}

/**
 * Venue-admin persona: Access Control — building roles with permissions and
 * verifying they resolve onto a user's effective permissions.
 */
describe('access control (venue admin)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resolves a role\'s permissions including inherited roles', async () => {
    writeRoles([
      { id: 'base', name: 'Base', permissions: ['admin.panel.access'], isSystem: true },
      { id: 'manager', name: 'Manager', permissions: ['admin.users.manage'], inheritsFrom: ['base'] },
    ]);
    const { getRolePermissionIds } = await import('./rbacBridge');
    const ids = getRolePermissionIds('manager');
    expect(ids).toContain('admin.users.manage');
    expect(ids).toContain('admin.panel.access'); // inherited from base
  });

  it('derives user effective permissions from an assigned role', async () => {
    writeRoles([
      { id: 'coordinator', name: 'Coordinator', permissions: ['admin.panel.access', 'admin.venues.manage'], isSystem: true },
    ]);
    const { resolveUserPermissions } = await import('./rbacBridge');
    const user = { id: 'u1', role: 'staff', assignedRoles: ['coordinator'] } as any;
    const perms = resolveUserPermissions(user);
    // Granular roles are authoritative: admin.panel.access does not silently
    // re-grant layout/guest flags that were not assigned.
    expect(perms.canEditLayout).toBe(false);
    expect(perms.canManageGuests).toBe(false);
    expect(perms.canViewLayout).toBe(false);
  });

  it('an unknown/removed role resolves to no permissions (fail-closed)', async () => {
    writeRoles([]);
    const { getUserPermissionIds } = await import('./rbacBridge');
    const user = { id: 'u1', role: 'staff', assignedRoles: ['deleted-role'] } as any;
    expect(getUserPermissionIds(user)).toEqual([]);
  });
});
