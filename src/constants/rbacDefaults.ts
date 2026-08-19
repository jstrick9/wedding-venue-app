import type { Role } from '../types/rbac';
import { PERMISSIONS } from './permissions';

/**
 * Canonical system roles. Both the Access Control editor (`useRBAC`) and the
 * enforcement bridge (`rbacBridge` / `permissions.ts`) must read the same
 * defaults so a cloud owner/admin still has authority before the Access Control
 * panel has ever been opened.
 */
export const DEFAULT_ROLES: Role[] = [
  {
    id: 'master-admin',
    name: 'Master Admin',
    description: 'Full system access - cannot be modified',
    permissions: PERMISSIONS.map((p) => p.id),
    isSystem: true,
    isImmutable: true,
    hierarchy: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrative access with most permissions',
    permissions: PERMISSIONS.filter((p) => !p.id.startsWith('admin.roles')).map((p) => p.id),
    isSystem: true,
    hierarchy: 90,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Venue manager with full operational and layout access',
    permissions: PERMISSIONS.filter((p) => !p.id.startsWith('admin.')).map((p) => p.id),
    isSystem: true,
    hierarchy: 70,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'basic',
    name: 'Basic User',
    description: 'Standard user with layout and guest management',
    permissions: [
      'layout.canvas.view',
      'layout.canvas.edit',
      'layout.canvas.delete',
      'layout.canvas.duplicate',
      'layout.undo.use',
      'guests.view',
      'guests.manage',
      'guests.assign',
      'guests.import',
      'guests.export',
      'decor.catalog.view',
      'decor.designer.use',
      'decor.designer.save',
      'decor.apply',
      'vendors.view',
      'timeline.view',
      'timeline.manage',
      'communication.chat',
      'portal.guest.view',
      'export.print',
      'export.share',
      'templates.view',
      'templates.use',
      'submissions.submit',
    ],
    isSystem: true,
    hierarchy: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Staff member with operations access',
    permissions: [
      'layout.canvas.view',
      'guests.view',
      'timeline.view',
      'timeline.manage',
      'timeline.events.complete',
      'communication.chat',
      'staff.operations.access',
      'staff.tasks.manage',
      'staff.areas.manage',
      'staff.shifts.manage',
      'export.print',
    ],
    isSystem: true,
    hierarchy: 40,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'guest',
    name: 'Guest',
    description: 'Guest portal access only',
    permissions: [
      'portal.guest.view',
      'portal.rsvp.submit',
      'portal.lodging.view',
    ],
    isSystem: true,
    hierarchy: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Supabase `app_role` values (and a few local aliases) mapped onto the local
 * RBAC role ids above. Cloud sessions store the raw membership role on
 * `user.assignedRoles`; without this alias an owner would look up a missing
 * "owner" role and lose every permission.
 */
export const RBAC_ROLE_ALIASES: Record<string, string> = {
  owner: 'master-admin',
  admin: 'admin',
  planner: 'manager',
  manager: 'manager',
  staff: 'staff',
  basic: 'basic',
  guest: 'guest',
  'master-admin': 'master-admin',
};

export function canonicalizeRoleId(roleId: string): string {
  return RBAC_ROLE_ALIASES[roleId] || roleId;
}
