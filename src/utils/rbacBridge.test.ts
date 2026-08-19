import { beforeEach, describe, expect, it } from 'vitest';
import {
  getRolePermissionIds,
  getUserPermissionIds,
  resolveUserPermissions,
  hasGranularPermission,
} from './rbacBridge';
import type { User } from '../types';

const ROLES_KEY = 'spm_rbac_roles';

function seedRoles(roles: unknown[]) {
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
}

const makeUser = (over: Record<string, unknown>): User =>
  ({
    id: 'u1',
    username: 'u1',
    email: 'u1@example.com',
    password: '',
    name: 'U',
    role: 'basic',
    isActive: true,
    createdAt: new Date().toISOString(),
    ...over,
  }) as User;

describe('rbacBridge', () => {
  beforeEach(() => localStorage.clear());

  it('returns no permissions for a user with no assigned role (legacy behavior)', () => {
    const user = makeUser({ permissions: { canPrint: true } });
    expect(resolveUserPermissions(user)).toEqual({ canPrint: true });
    expect(getUserPermissionIds(user)).toEqual([]);
  });

  it('grants flags from the assigned role permissions', () => {
    seedRoles([
      { id: 'editor', permissions: ['layout.canvas.edit', 'guests.manage', 'export.print'] },
    ]);
    const user = makeUser({ assignedRoles: ['editor'] });

    const perms = resolveUserPermissions(user);
    expect(perms.canEditLayout).toBe(true);
    expect(perms.canManageGuests).toBe(true);
    expect(perms.canPrint).toBe(true);
    // Not granted by the role -> denied (role is authoritative).
    expect(perms.canExport).toBe(false);
    expect(perms.canViewLayout).toBe(false);
  });

  it('includes inherited role permissions', () => {
    seedRoles([
      { id: 'base', permissions: ['layout.canvas.view'] },
      { id: 'editor', permissions: ['layout.canvas.edit'], inheritsFrom: ['base'] },
    ]);
    const user = makeUser({ assignedRoles: ['editor'] });
    expect(getRolePermissionIds('editor')).toContain('layout.canvas.view');
    expect(getUserPermissionIds(user)).toContain('layout.canvas.edit');
    expect(getUserPermissionIds(user)).toContain('layout.canvas.view');
    expect(resolveUserPermissions(user).canViewLayout).toBe(true);
  });

  it('does not implicitly re-grant flags from admin.panel.access (role is authoritative)', () => {
    seedRoles([
      { id: 'limited-admin', permissions: ['admin.panel.access', 'layout.canvas.view'] },
    ]);
    const user = makeUser({ assignedRoles: ['limited-admin'] });
    const perms = resolveUserPermissions(user);
    expect(perms.canViewLayout).toBe(true);
    expect(perms.canEditLayout).toBe(false);
    expect(perms.canManageGuests).toBe(false);
    expect(perms.canPrint).toBe(false);
  });

  it('aliases a Supabase owner role onto master-admin defaults', () => {
    const user = makeUser({ assignedRoles: ['owner'] });
    expect(getRolePermissionIds('owner')).toContain('admin.panel.access');
    expect(resolveUserPermissions(user).canEditLayout).toBe(true);
    expect(hasGranularPermission(user, 'admin.panel.access')).toBe(true);
  });

  it('does not recurse forever on cyclic role inheritance', () => {
    seedRoles([
      { id: 'cycle-a', permissions: ['layout.canvas.view'], inheritsFrom: ['cycle-b'] },
      { id: 'cycle-b', permissions: ['export.print'], inheritsFrom: ['cycle-a'] },
    ]);
    const ids = getRolePermissionIds('cycle-a');
    expect(ids).toContain('layout.canvas.view');
    expect(ids).toContain('export.print');
  });

  it('explicit user.permissions override role-derived flags', () => {
    seedRoles([
      { id: 'limited', permissions: ['layout.canvas.edit'] },
    ]);
    const user = makeUser({
      assignedRoles: ['limited'],
      permissions: { canPrint: true },
    });
    const perms = resolveUserPermissions(user);
    expect(perms.canEditLayout).toBe(true);
    // Explicit true wins even though role doesn't grant print.
    expect(perms.canPrint).toBe(true);
  });

  it('hasGranularPermission checks the assigned role set', () => {
    seedRoles([{ id: 'r', permissions: ['export.print'] }]);
    const user = makeUser({ assignedRoles: ['r'] });
    expect(hasGranularPermission(user, 'export.print')).toBe(true);
    expect(hasGranularPermission(user, 'export.download')).toBe(false);
  });
});
