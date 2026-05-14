import React from 'react';
import { User } from '../../types';
import { Config } from '../../config';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';

interface UserManagementProps {
  users: User[];
  config: Config;
  onSaveUsers: (users: User[]) => void;
  onShowCreateModal: () => void;
  expandedUsers: Set<string>;
  onToggleUser: (id: string) => void;
}

export function UserManagement({ users, config, onSaveUsers, onShowCreateModal, expandedUsers, onToggleUser }: UserManagementProps) {
  return (
    <div className="space-y-4">
      <BrandedSectionHeader icon="👥" title="User Management" description="Manage user accounts and roles" config={config} />

      <div className="flex justify-end">
        <button onClick={onShowCreateModal} className="px-4 py-2 bg-[#4A1942] text-white rounded-lg">+ Add User</button>
      </div>

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="bg-white rounded-xl border p-4">
            <div className="flex justify-between cursor-pointer" onClick={() => onToggleUser(u.id)}>
              <div>
                <span className="font-semibold">{u.name}</span>
                <span className="ml-2 text-xs text-gray-500">@{u.username}</span>
              </div>
              <div className="flex gap-2">
                <span className={`px-2 py-0.5 text-xs rounded ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span>
                <button onClick={(e) => { e.stopPropagation(); onSaveUsers(users.filter(x => x.id !== u.id)); }} className="text-red-500">🗑️</button>
              </div>
            </div>

            {expandedUsers.has(u.id) && (
              <div className="mt-4 text-sm text-gray-600">
                <p>Email: {u.email || 'N/A'}</p>
                <p>Status: {u.isActive !== false ? 'Active' : 'Inactive'}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}