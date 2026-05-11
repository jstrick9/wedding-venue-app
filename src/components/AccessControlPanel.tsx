import React, { useState, useMemo } from 'react';
import { useRBAC } from '../hooks/useRBAC';
import { useAuth } from '../contexts/AuthContext';
import { Role, PermissionDefinition, PermissionGroup } from '../types/rbac';
import { PERMISSIONS, getChildPermissions } from '../constants/permissions';

interface AccessControlPanelProps {
  onClose: () => void;
}

export function AccessControlPanel({ onClose }: AccessControlPanelProps) {
  const { user } = useAuth();
  const {
    roles,
    groups,
    auditLog,
    createRole,
    updateRole,
    deleteRole,
    addPermissionToRole,
    removePermissionFromRole,
    getRolePermissions,
    copyPermissions,
    createGroup,
    deleteGroup,
  } = useRBAC();

  const [activeTab, setActiveTab] = useState<'roles' | 'permissions' | 'audit'>('roles');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [viewMode, setViewMode] = useState<'matrix' | 'tree'>('tree');

  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
    hierarchy: 50,
    inheritsFrom: [] as string[],
  });

  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const selectedRolePermissions = selectedRoleId ? getRolePermissions(selectedRoleId) : [];

  // Group permissions by category
  const permissionsByGroup = useMemo(() => {
    const result: Record<string, PermissionDefinition[]> = {};
    for (const group of groups) {
      result[group.id] = PERMISSIONS.filter(p => p.category === group.id);
    }
    return result;
  }, [groups]);

  const handleCreateRole = () => {
    if (!newRole.name.trim() || !user) return;
    createRole(
      {
        name: newRole.name.trim(),
        description: newRole.description,
        permissions: newRole.permissions,
        hierarchy: newRole.hierarchy,
        inheritsFrom: newRole.inheritsFrom,
      },
      user.id,
      user.name
    );
    setNewRole({ name: '', description: '', permissions: [], hierarchy: 50, inheritsFrom: [] });
    setShowCreateRole(false);
  };

  const handleTogglePermission = (permissionId: string) => {
    if (!selectedRoleId || !user) return;
    const perm = PERMISSIONS.find(p => p.id === permissionId);
    if (perm?.isLocked && selectedRole?.isImmutable) return;

    if (selectedRolePermissions.includes(permissionId)) {
      removePermissionFromRole(selectedRoleId, permissionId, user.id, user.name);
    } else {
      addPermissionToRole(selectedRoleId, permissionId, user.id, user.name);
    }
  };

  const handleCopyPermissions = (fromRoleId: string) => {
    if (!selectedRoleId || !user) return;
    copyPermissions(fromRoleId, selectedRoleId, user.id, user.name);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
      <div className="w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4A1942] to-[#3d1a45] text-white p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">🔐 Access Control</h2>
            <p className="text-sm text-white/70">Manage roles, permissions, and user access</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { id: 'roles', label: '👥 Roles', count: roles.length },
            { id: 'permissions', label: '🔑 Permissions', count: PERMISSIONS.length },
            { id: 'audit', label: '📋 Audit Log', count: auditLog.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-[#4A1942] text-[#4A1942]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {/* Roles Tab */}
          {activeTab === 'roles' && (
            <div className="flex h-full">
              {/* Role List */}
              <div className="w-64 border-r border-gray-200 flex flex-col">
                <div className="p-3 border-b border-gray-200">
                  <button
                    onClick={() => setShowCreateRole(true)}
                    className="w-full py-2 bg-[#4A1942] text-white rounded-lg text-sm font-medium hover:bg-[#3b1435] transition-colors"
                  >
                    ➕ Create Role
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  {roles.map(role => (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`w-full p-3 text-left border-b border-gray-100 transition-colors ${
                        selectedRoleId === role.id
                          ? 'bg-purple-50 border-l-4 border-l-[#4A1942]'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{role.name}</div>
                          <div className="text-xs text-gray-500">
                            {role.permissions.length} permissions
                          </div>
                        </div>
                        {role.isImmutable && <span className="text-xs">🔒</span>}
                        {role.isSystem && !role.isImmutable && <span className="text-xs">⚙️</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Role Details */}
              <div className="flex-1 p-4 overflow-auto">
                {!selectedRole ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-4xl mb-2">👆</div>
                    <p>Select a role to view and edit permissions</p>
                  </div>
                ) : (
                  <div>
                    {/* Role Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{selectedRole.name}</h3>
                        <p className="text-sm text-gray-500">{selectedRole.description}</p>
                      </div>
                      <div className="flex gap-2">
                        {/* Copy permissions dropdown */}
                        <div className="relative group">
                          <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors">
                            📋 Copy From
                          </button>
                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10 min-w-48">
                            {roles.filter(r => r.id !== selectedRole.id).map(r => (
                              <button
                                key={r.id}
                                onClick={() => handleCopyPermissions(r.id)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                              >
                                {r.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        {!selectedRole.isImmutable && !selectedRole.isSystem && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete role "${selectedRole.name}"?`)) {
                                deleteRole(selectedRole.id, user?.id || '', user?.name || '');
                                setSelectedRoleId(null);
                              }
                            }}
                            className="px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg text-sm transition-colors"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setViewMode('tree')}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          viewMode === 'tree'
                            ? 'bg-[#4A1942] text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        🌳 Tree View
                      </button>
                      <button
                        onClick={() => setViewMode('matrix')}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          viewMode === 'matrix'
                            ? 'bg-[#4A1942] text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        📊 Matrix View
                      </button>
                    </div>

                    {/* Tree View */}
                    {viewMode === 'tree' && (
                      <div className="space-y-4">
                        {groups.map(group => {
                          const groupPermissions = permissionsByGroup[group.id] || [];
                          if (groupPermissions.length === 0) return null;

                          return (
                            <div key={group.id} className="bg-gray-50 rounded-xl p-4">
                              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                <span>{group.icon}</span>
                                <span>{group.name}</span>
                              </h4>
                              <div className="space-y-2">
                                {groupPermissions
                                  .filter(p => !p.parentId)
                                  .map(permission => (
                                    <PermissionCheckbox
                                      key={permission.id}
                                      permission={permission}
                                      checked={selectedRolePermissions.includes(permission.id)}
                                      onToggle={handleTogglePermission}
                                      allPermissions={selectedRolePermissions}
                                      disabled={selectedRole.isImmutable}
                                      level={0}
                                    />
                                  ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Matrix View */}
                    {viewMode === 'matrix' && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="p-2 text-left">Permission</th>
                              <th className="p-2 text-center">Granted</th>
                            </tr>
                          </thead>
                          <tbody>
                            {PERMISSIONS.map(perm => (
                              <tr key={perm.id} className="border-t border-gray-100">
                                <td className="p-2">
                                  <div className="font-medium">{perm.label}</div>
                                  <div className="text-xs text-gray-500">{perm.id}</div>
                                </td>
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedRolePermissions.includes(perm.id)}
                                    onChange={() => handleTogglePermission(perm.id)}
                                    disabled={selectedRole.isImmutable || (perm.isLocked && selectedRole.isImmutable)}
                                    className="w-4 h-4 rounded border-gray-300 text-[#4A1942] focus:ring-[#4A1942]"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === 'permissions' && (
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4">All Permissions ({PERMISSIONS.length})</h3>
              <div className="space-y-4">
                {groups.map(group => {
                  const groupPermissions = permissionsByGroup[group.id] || [];
                  if (groupPermissions.length === 0) return null;

                  return (
                    <div key={group.id} className="bg-gray-50 rounded-xl p-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <span>{group.icon}</span>
                        <span>{group.name}</span>
                        <span className="text-xs text-gray-400">({groupPermissions.length})</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {groupPermissions.map(perm => (
                          <div
                            key={perm.id}
                            className="bg-white p-3 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{perm.label}</span>
                              {perm.isLocked && <span className="text-xs">🔒</span>}
                            </div>
                            <p className="text-xs text-gray-500 mb-1">{perm.description}</p>
                            <code className="text-xs text-purple-600 bg-purple-50 px-1 rounded">
                              {perm.id}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audit Log Tab */}
          {activeTab === 'audit' && (
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4">Audit Log ({auditLog.length})</h3>
              {auditLog.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No audit entries yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLog.map(entry => (
                    <div
                      key={entry.id}
                      className="bg-gray-50 p-3 rounded-lg flex items-start gap-3"
                    >
                      <div className="text-lg">
                        {entry.action.includes('create') && '➕'}
                        {entry.action.includes('delete') && '🗑️'}
                        {entry.action.includes('update') && '✏️'}
                        {entry.action.includes('added') && '✅'}
                        {entry.action.includes('removed') && '❌'}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{entry.details}</div>
                        <div className="text-xs text-gray-500">
                          By {entry.performedByName} • {new Date(entry.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Role Modal */}
        {showCreateRole && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10001 }}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-semibold mb-4">Create New Role</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                  <input
                    type="text"
                    value={newRole.name}
                    onChange={e => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Event Coordinator"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newRole.description}
                    onChange={e => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hierarchy Level</label>
                  <input
                    type="number"
                    value={newRole.hierarchy}
                    onChange={e => setNewRole(prev => ({ ...prev, hierarchy: parseInt(e.target.value) || 50 }))}
                    min={0}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Higher = more access (Master Admin = 100)</p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateRole(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRole}
                  disabled={!newRole.name.trim()}
                  className="flex-1 px-4 py-2 bg-[#4A1942] text-white rounded-lg hover:bg-[#3b1435] disabled:opacity-50"
                >
                  Create Role
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Permission Checkbox Component with hierarchy support
function PermissionCheckbox({
  permission,
  checked,
  onToggle,
  allPermissions,
  disabled,
  level,
}: {
  permission: PermissionDefinition;
  checked: boolean;
  onToggle: (id: string) => void;
  allPermissions: string[];
  disabled: boolean;
  level: number;
}) {
  const children = getChildPermissions(permission.id);
  const hasChildren = children.length > 0;

  return (
    <div style={{ marginLeft: level * 20 }}>
      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(permission.id)}
          disabled={disabled || permission.isLocked}
          className="w-4 h-4 rounded border-gray-300 text-[#4A1942] focus:ring-[#4A1942]"
        />
        <div className="flex-1">
          <div className="text-sm font-medium flex items-center gap-1">
            {permission.label}
            {permission.isLocked && <span className="text-xs">🔒</span>}
          </div>
          <div className="text-xs text-gray-500">{permission.description}</div>
        </div>
      </label>
      {hasChildren && checked && (
        <div className="mt-1 space-y-1">
          {children.map(child => (
            <PermissionCheckbox
              key={child.id}
              permission={child}
              checked={allPermissions.includes(child.id)}
              onToggle={onToggle}
              allPermissions={allPermissions}
              disabled={disabled}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default AccessControlPanel;