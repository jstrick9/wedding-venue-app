import React from 'react';
import { BrandedSectionHeader, BrandedStatCard } from './shared/AdminSharedComponents';
import { DirectMessagePanel } from '../DirectMessagePanel';
import { AdminSubmissionQueue } from '../AdminSubmissionQueue';
import { buildCoupleInviteUrl, getCoupleEvents, updateCoupleEvent, hasVenueCoordination } from '../../services/couples/coupleService';
import { emit, emitDataChanged } from '../../utils/appEvents';
import { User } from '../../types';
import type { AdminCommonProps } from './AdminTabTypes';

export function UserManagement(props: AdminCommonProps) {
  const {
    config,
    users,
    directMessages,
    user,
    selectedMessageMasterUserId,
    setSelectedMessageMasterUserId,
    buildMessageThreadId,
    setShowCreateUserModal,
    handleSaveUsers,
    handleDeleteUser,
    submissionWorkflow,
    showUserDirectMessagesSection,
    setShowUserDirectMessagesSection,
    showUserPendingApprovalsSection,
    setShowUserPendingApprovalsSection,
    showUserAccountsSection,
    setShowUserAccountsSection,
    showSuccess,
    showInfo,
    createPasswordRecord,
    getUserFieldErrors,
    createUserFieldErrors,
    setCreateUserFieldErrors,
    newUser,
    setNewUser,
    handleCreateUser,
    expandedUsers,
    setExpandedUsers,
    showCreateUserModal,
    allRoles,
  } = props;

  // Live search + role/status filters for the user list (the controls previously
  // rendered but did nothing).
  const [userSearch, setUserSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [userMgmtTab, setUserMgmtTab] = React.useState<'internal' | 'couples-guests'>('internal');
  const [coupleEventsList, setCoupleEventsList] = React.useState(() => getCoupleEvents());

  const handleToggleCoordination = (coupleId: string) => {
    const target = coupleEventsList.find((c) => c.id === coupleId);
    if (!target) return;
    const isBooked = hasVenueCoordination(target);
    updateCoupleEvent(coupleId, { venueCoordinationBooked: !isBooked });
    setCoupleEventsList(getCoupleEvents());
    showSuccess('Updated Day of Coordination access for couple.');
    emitDataChanged('coupleEvents');
  };

  const [showStaffEventMatrixModal, setShowStaffEventMatrixModal] = React.useState(false);
  const [selectedEventRoleMap, setSelectedEventRoleMap] = React.useState<Record<string, string>>({});

  const handleToggleStaffEventAssignment = (staffUser: User, eventId: string, roleTitle: string = 'Day-of Staff') => {
    const currentIds = staffUser.assignedEventIds || [];
    const isAssigned = currentIds.includes(eventId);
    const nextIds = isAssigned
      ? currentIds.filter((id) => id !== eventId)
      : [...currentIds, eventId];
    const currentRoles = { ...(staffUser.assignedEventRoles || {}) };
    if (isAssigned) {
      delete currentRoles[eventId];
    } else {
      currentRoles[eventId] = roleTitle;
    }
    const updatedUsers = users.map((u) =>
      u.id === staffUser.id
        ? { ...u, assignedEventIds: nextIds, assignedEventRoles: currentRoles, updatedAt: new Date().toISOString() }
        : u
    );
    handleSaveUsers(updatedUsers);
    showSuccess(
      isAssigned
        ? `Removed ${staffUser.name} from event assignment.`
        : `Assigned ${staffUser.name} as ${roleTitle} to event.`
    );
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q);
    const matchesRole =
      !roleFilter ||
      u.role === roleFilter ||
      (roleFilter === 'staff' && u.role !== 'admin');
    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'active' ? u.isActive !== false : u.isActive === false);
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="space-y-4">
              {/* Header */}
              <BrandedSectionHeader
                icon="👥"
                title="User Management"
                description="Create, manage, and configure user accounts and permissions"
                config={config}
              />

              {/* User Management Account Type Tabs */}
              <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
                <button
                  type="button"
                  onClick={() => setUserMgmtTab('internal')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    userMgmtTab === 'internal'
                      ? 'text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  style={userMgmtTab === 'internal' ? { backgroundColor: config.primaryColor || '#4A1942' } : undefined}
                >
                  👥 Internal Venue Staff &amp; Admins ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserMgmtTab('couples-guests')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    userMgmtTab === 'couples-guests'
                      ? 'text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  style={userMgmtTab === 'couples-guests' ? { backgroundColor: config.primaryColor || '#4A1942' } : undefined}
                >
                  💍 Couples &amp; Guest Portal Accounts ({coupleEventsList.length})
                </button>
              </div>

              {userMgmtTab === 'couples-guests' ? (
                <div className="space-y-6">
                  {/* Couples & Guest Portal Accounts Overview Banner */}
                  <div className="rounded-xl border p-5 bg-purple-50/70 border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="font-bold text-base text-purple-900">
                        💍 Couples &amp; Guest Portal Accounts Management
                      </h3>
                      <p className="text-xs text-purple-700 max-w-3xl">
                        Manage all external client portal accounts linked to your venue&apos;s booked events. Control layout approval workflows, toggle Day of Coordination timeline permissions, copy invite links, and open direct messaging chats.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => emit('spm_open_chat')}
                      className="px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm shrink-0 transition-colors"
                      style={{ backgroundColor: config.primaryColor || '#4A1942' }}
                    >
                      💬 Open Portal Chat &amp; DMs
                    </button>
                  </div>

                  {/* Couples List */}
                  <div className="grid grid-cols-1 gap-4">
                    {coupleEventsList.length === 0 ? (
                      <div className="p-8 text-center bg-white rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm">
                        No couple events booked yet. Create a couple event in the Couples Portal or Admin Panel.
                      </div>
                    ) : (
                      coupleEventsList.map((couple) => {
                        const isCoordinationBooked = hasVenueCoordination(couple);
                        const portalLink = buildCoupleInviteUrl(couple.inviteToken);
                        return (
                          <div
                            key={couple.id}
                            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                          >
                            <div className="space-y-2 max-w-xl">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-xl">💍</span>
                                <h4 className="text-base font-bold text-gray-900">
                                  {couple.coupleName}
                                </h4>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    couple.layoutStatus === 'approved'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : couple.layoutStatus === 'pending' || couple.layoutStatus === 'changes_requested'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {couple.layoutStatus}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 flex flex-wrap items-center gap-4">
                                <span>📅 Date: {couple.eventDate ? new Date(couple.eventDate).toLocaleDateString() : 'Not set'}</span>
                                <span>👥 Expected Guests: {couple.guestCount || 0}</span>
                                <span>🔑 Token: <code>{couple.inviteToken}</code></span>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isCoordinationBooked}
                                    onChange={() => handleToggleCoordination(couple.id)}
                                    className="rounded border-gray-300 text-[#4A1942] focus:ring-[#4A1942]"
                                  />
                                  <span className={isCoordinationBooked ? 'text-purple-900 font-bold' : 'text-gray-600'}>
                                    ★ Day of Coordination Booked ($1,000) — {isCoordinationBooked ? 'Full Collaborative Timeline' : 'Read-Only Venue Preview'}
                                  </span>
                                </label>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 flex-wrap lg:justify-end shrink-0">
                              <button
                                type="button"
                                onClick={() => window.open(portalLink, '_blank')}
                                className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors shadow-sm"
                              >
                                💍 Open Couples Portal ↗
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(portalLink);
                                  showInfo('Link Copied', 'Copied Couples Portal link to clipboard.');
                                }}
                                className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors shadow-sm"
                              >
                                📋 Copy Link
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const subject = `Your Wedding Planning Portal — ${couple.coupleName}`;
                                  const body = `Hi ${couple.coupleName},\n\nWe're so excited to work with you on your wedding!\n\nHere is your private link to access your Couples Portal, where you can design your floor layouts, manage your guest list & RSVPs, view wedding packages, and chat directly with our venue team:\n\n${portalLink}\n\nWarm regards,\nThe Seven Paths Manor Team`;
                                  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                  showInfo('Email Invite', `Opening email draft for ${couple.coupleName}.`);
                                }}
                                className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors shadow-sm"
                                title="Open default email client with pre-drafted Couples Portal invite link"
                              >
                                ✉️ Email Invite
                              </button>
                              <button
                                type="button"
                                onClick={() => emit('spm_open_chat')}
                                className="px-4 py-2 rounded-lg text-white text-xs font-bold shadow-sm transition-colors"
                                style={{ backgroundColor: config.primaryColor || '#4A1942' }}
                              >
                                💬 Portal Chat
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowCreateUserModal(true)}
                    className="btn-primary px-4 py-2.5 text-white rounded-lg hover:shadow-lg transition-all font-bold flex items-center gap-2"
                    style={{
                      background: `linear-gradient(135deg, ${config.primaryColor || '#4A1942'}, ${config.primaryDark || '#3d1a45'})`,
                    }}
                  >
                    <span className="text-lg">➕</span> Add User
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowStaffEventMatrixModal(true)}
                    className="px-4 py-2.5 bg-white border border-purple-200 text-[#4A1942] hover:bg-purple-50 rounded-lg hover:shadow transition-all font-bold text-sm flex items-center gap-2"
                    style={{ borderColor: `color-mix(in srgb, ${config.primaryColor || '#4A1942'} 30%, transparent)`, color: config.primaryColor || '#4A1942' }}
                  >
                    <span>🗓️</span> Assign Staff to Events
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-gray-600">
                  <span className="flex items-center gap-1.5 bg-purple-50 text-purple-900 px-2.5 py-1 rounded-full border border-purple-200">
                    <span className="w-2.5 h-2.5 bg-purple-600 rounded-full"></span> 👑 Administrator (Full System Access)
                  </span>
                  <span className="flex items-center gap-1.5 bg-blue-50 text-blue-900 px-2.5 py-1 rounded-full border border-blue-200">
                    <span className="w-2.5 h-2.5 bg-blue-600 rounded-full"></span> 🛡️ Manager/Staff (Operations Access)
                  </span>
                  <span className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full border border-gray-200">
                    <span className="w-2.5 h-2.5 bg-gray-400 rounded-full"></span> ⏸️ Inactive
                  </span>
                </div>
              </div>
              
              {/* Direct Messages (Admin) */}
              {user?.role === 'admin' && (() => {
                const staffMembers = users.filter(
                  (u) => u.id !== user?.id && u.isActive !== false,
                );
                const selectedStaff =
                  staffMembers.find((u) => u.id === selectedMessageMasterUserId) || staffMembers[0] || null;
                const threadId = selectedStaff
                  ? buildMessageThreadId(selectedStaff.department || 'internal', selectedStaff.id)
                  : '';
                const newMessageCount = staffMembers.reduce((sum, m) => {
                  const tId = buildMessageThreadId(m.department || 'internal', m.id);
                  return sum + directMessages.unreadCountForRole(tId, 'admin');
                }, 0);

                return (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowUserDirectMessagesSection(v => !v)}
                      className="w-full px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{showUserDirectMessagesSection ? '▼' : '▶'}</span>
                        <h4 className="text-sm font-semibold text-gray-800">💬 Internal Venue Staff Messaging</h4>
                        {newMessageCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                            {newMessageCount} new
                          </span>
                        )}
                      </div>
                    </button>
                    {showUserDirectMessagesSection && (
                      <div className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-gray-500">Admin ↔ Internal Staff communication thread across the venue.</p>
                          {staffMembers.length > 0 && (
                            <select
                              value={selectedStaff?.id || ''}
                              onChange={(e) => setSelectedMessageMasterUserId(e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942] focus:border-transparent min-w-[260px]"
                            >
                              {staffMembers.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} (@{m.username} • {m.jobTitle || 'Internal Staff'})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {selectedStaff && threadId ? (
                          <div className="mt-4">
                            <DirectMessagePanel
                              title={`Chat with ${selectedStaff.name}`}
                              threadId={threadId}
                              currentUserId={user.id}
                              currentUserName={user.name}
                              currentUserRole="admin"
                            />
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-gray-500">
                            No other active staff members available yet. Create another Internal Staff account to start messaging.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Pending Approvals (Admin) */}
              {user?.role === 'admin' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowUserPendingApprovalsSection(v => !v)}
                    className="w-full px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{showUserPendingApprovalsSection ? '▼' : '▶'}</span>
                      <h4 className="text-sm font-semibold text-gray-800">Pending Approvals</h4>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                        {submissionWorkflow.pendingCount}
                      </span>
                    </div>
                  </button>
                  {showUserPendingApprovalsSection && (
                    <div className="p-4">
                      <AdminSubmissionQueue
                        submissions={submissionWorkflow.submissions}
                        pendingCount={submissionWorkflow.pendingCount}
                        adminUserId={user.id}
                        adminName={user.name}
                        onReview={submissionWorkflow.review}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* User Accounts */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowUserAccountsSection(v => !v)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{showUserAccountsSection ? '▼' : '▶'}</span>
                    <h4 className="text-sm font-semibold text-gray-800">User Accounts</h4>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">{users.length}</span>
                  </div>
                </button>

                {showUserAccountsSection && (
                <div className="p-4 space-y-4">
              {/* User Statistics Dashboard */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <BrandedStatCard
                  value={users.length}
                  label="Total Users"
                  icon="👥"
                  config={config}
                />
                <BrandedStatCard
                  value={users.filter(u => u.role === 'admin').length}
                  label="Administrators"
                  icon="👑"
                  config={config}
                  variant="accent"
                />
                <BrandedStatCard
                  value={users.filter(u => u.role !== 'admin').length}
                  label="Operations Staff"
                  icon="🛡️"
                  config={config}
                />
                <BrandedStatCard
                  value={users.filter(u => u.isActive !== false).length}
                  label="Active"
                  icon="✅"
                  config={config}
                  variant="success"
                />
                <BrandedStatCard
                  value={users.filter(u => u.isActive === false).length}
                  label="Inactive"
                  icon="⏸️"
                  config={config}
                />
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 text-center hover:shadow-md transition-shadow">
                  <div className="text-3xl font-bold text-gray-700">{users.reduce((sum, u) => sum + (u.loginCount || 0), 0)}</div>
                  <div className="text-xs text-gray-600 font-medium mt-1">Total Logins</div>
                  <div className="mt-2 text-2xl">📊</div>
                </div>
              </div>

              {/* Search and Filter */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input
                      type="text"
                      placeholder="Search users by name, username, or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                      aria-label="Search users"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-white"
                      aria-label="Filter by role"
                    >
                      <option value="">All Roles</option>
                      <option value="admin">👑 Admins</option>
                      <option value="staff">🛡️ Operations Staff</option>
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-white"
                      aria-label="Filter by status"
                    >
                      <option value="">All Status</option>
                      <option value="active">✅ Active</option>
                      <option value="inactive">⏸️ Inactive</option>
                    </select>
                  </div>
                </div>
                {(userSearch.trim() || roleFilter || statusFilter) && (
                  <div className="mt-2 text-xs text-gray-500">
                    Showing <strong>{filteredUsers.length}</strong> of {users.length} users
                    {' '}
                    <button
                      type="button"
                      onClick={() => { setUserSearch(''); setRoleFilter(''); setStatusFilter(''); }}
                      className="text-[#4A1942] underline ml-1"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
              
              {/* User List */}
              {users.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                  <div className="text-6xl mb-4">👤</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Users Yet</h3>
                  <p className="text-gray-500 mb-4">Get started by creating your first user account</p>
                  <button
                    onClick={() => setShowCreateUserModal(true)}
                    className="btn-primary px-6 py-3 text-white rounded-lg hover:shadow-lg transition-all font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${config.primaryColor || '#4A1942'}, ${config.primaryDark || '#3d1a45'})`,
                    }}
                  >
                    ➕ Create First User
                  </button>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                  <div className="text-4xl mb-3">🔍</div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">No users match your filters</h3>
                  <p className="text-gray-500 text-sm">Try adjusting the search or clearing the role/status filters.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map(u => {
                    const isExpanded = expandedUsers.has(u.id);
                    const lastLoginDate = u.lastLogin ? new Date(u.lastLogin) : null;
                    const isOnline = lastLoginDate && (Date.now() - lastLoginDate.getTime()) < 86400000; // Within 24h
                    const validator = getUserFieldErrors || ((): Record<string, string> => ({}));
                    const editUserFieldErrors = validator({
                      username: u.username,
                      name: u.name,
                      email: u.email,
                      contactPhoneNumber: u.contactPhoneNumber || u.phone,
                      phoneType: u.phoneType,
                      eventRole: u.eventRole || u.jobTitle,
                      eventName: u.eventName || u.department,
                      userRole: u.userRole || (u.role === 'admin' ? 'admin' : 'shared'),
                      eventDate: u.eventDate,
                      preferredCommunication: u.preferredCommunication,
                      allowSharedAccess: u.allowSharedAccess,
                      sharedUserLimit: u.sharedUserLimit,
                    }, false);
                    
                    return (
                      <div key={u.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all hover:shadow-md ${
                        u.isActive === false ? 'border-gray-300 opacity-60' : 
                        u.role === 'admin' ? 'border-purple-300' : 'border-blue-200'
                      }`}>
                        {/* User Header - Always Visible */}
                        <div 
                          className={`px-4 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                            u.role === 'admin' 
                              ? 'bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-150' 
                              : 'bg-gradient-to-r from-gray-50 to-blue-50 hover:from-gray-100 hover:to-blue-100'
                          }`}
                          onClick={() => {
                            setExpandedUsers(prev => {
                              const next = new Set(prev);
                              if (next.has(u.id)) {
                                next.delete(u.id);
                              } else {
                                next.add(u.id);
                              }
                              return next;
                            });
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <span className={`text-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                            {/* User Avatar with Status Indicator */}
                            <div className="relative">
                              {u.imageUrl ? (
                                <img src={u.imageUrl} alt={u.name} className="w-12 h-12 rounded-full object-cover border-3 border-white shadow-sm" />
                              ) : (
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-sm ${
                                  u.role === 'admin' 
                                    ? 'bg-gradient-to-br from-purple-400 to-purple-600 text-white' 
                                    : 'bg-gradient-to-br from-blue-400 to-blue-600 text-white'
                                }`}>
                                  {u.name?.charAt(0).toUpperCase() || '?'}
                                </div>
                              )}
                              {/* Online/Status indicator */}
                              <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                                u.isActive === false ? 'bg-gray-400' :
                                isOnline ? 'bg-green-500' : 'bg-yellow-500'
                              }`} title={u.isActive === false ? 'Inactive' : isOnline ? 'Recently Active' : 'Away'} />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-800 flex items-center gap-2">
                                {u.name}
                                {u.role === 'admin' && <span className="text-lg" title="Administrator">👑</span>}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-2">
                                <span>@{u.username}</span>
                                {u.email && <span className="text-gray-300">•</span>}
                                {u.email && <span className="text-xs text-gray-400">{u.email}</span>}
                              </div>
                              {u.jobTitle && (
                                <div className="text-xs text-gray-400 mt-0.5">{u.jobTitle}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            {/* Activity Info */}
                            <div className="hidden md:flex flex-col items-end text-xs text-gray-400">
                              {u.lastLogin && (
                                <span>Last login: {new Date(u.lastLogin).toLocaleDateString()}</span>
                              )}
                              {u.loginCount !== undefined && u.loginCount > 0 && (
                                <span>{u.loginCount} login{u.loginCount !== 1 ? 's' : ''}</span>
                              )}
                            </div>
                            {/* Role Badge - Updated to show RBAC role name */}
							<span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
							  u.isActive === false 
								? 'bg-gray-100 text-gray-500'
								: allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.hierarchy && 
								  allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.hierarchy! >= 90
								  ? 'bg-purple-100 text-purple-700 border border-purple-200'
								  : 'bg-blue-100 text-blue-700 border border-blue-200'
							}`}>
							  {u.isActive === false 
								? '⏸️ Inactive' 
								: allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.name || u.role}
							</span>
                            {/* Action Buttons */}
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setExpandedUsers(prev => new Set(prev).add(u.id));
                                }}
                                className="p-2 text-gray-500 hover:bg-white hover:text-[#4A1942] rounded-lg transition-colors"
                                title="Edit user"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id, u.name || u.email || u.username)}
                                className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                                title="Delete user"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* User Details - Collapsible */}
                        {isExpanded && (
                          <div className="p-5 border-t-2 border-gray-100 space-y-5 bg-gradient-to-b from-white to-gray-50">
                            {/* Profile Section */}
                            <div className="flex flex-col md:flex-row gap-6 pb-5 border-b border-gray-200">
                              {/* Profile Image */}
                              <div className="flex flex-col items-center">
                                <div className="relative group">
                                  {u.imageUrl ? (
                                    <img src={u.imageUrl} alt={u.name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
                                  ) : (
                                    <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold shadow-lg ${
                                      u.role === 'admin' 
                                        ? 'bg-gradient-to-br from-purple-400 to-purple-600 text-white' 
                                        : 'bg-gradient-to-br from-blue-400 to-blue-600 text-white'
                                    }`}>
                                      {u.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                  )}
                                  <label htmlFor={`user-avatar-upload-${u.id}`} className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <span className="text-white text-2xl">📷</span>
                                    <input
                                      id={`user-avatar-upload-${u.id}`}
                                      type="file"
                                      accept="image/*"
                                      className="sr-only"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (event) => {
                                            const imageUrl = event.target?.result as string;
                                            handleSaveUsers(users.map(usr => 
                                              usr.id === u.id ? { ...usr, imageUrl, updatedAt: new Date().toISOString() } : usr
                                            ));
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                                {u.imageUrl && (
                                  <button
                                    onClick={() => handleSaveUsers(users.map(usr => 
                                      usr.id === u.id ? { ...usr, imageUrl: '', updatedAt: new Date().toISOString() } : usr
                                    ))}
                                    className="mt-2 text-xs text-red-500 hover:underline"
                                  >
                                    🗑️ Remove Photo
                                  </button>
                                )}
                                <p className="text-xs text-gray-400 mt-2 text-center">Hover to upload</p>
                              </div>
                              
                              {/* Quick Stats */}
                              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                                  <div className="text-2xl mb-1">📅</div>
                                  <div className="text-xs text-gray-500">Member Since</div>
                                  <div className="text-sm font-semibold text-gray-700">
                                    {new Date(u.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                                  <div className="text-2xl mb-1">🔐</div>
                                  <div className="text-xs text-gray-500">Last Login</div>
                                  <div className="text-sm font-semibold text-gray-700">
                                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                                  </div>
                                </div>
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                                  <div className="text-2xl mb-1">📊</div>
                                  <div className="text-xs text-gray-500">Total Logins</div>
                                  <div className="text-sm font-semibold text-gray-700">{u.loginCount || 0}</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                                  <div className="text-2xl mb-1">{u.isActive !== false ? '✅' : '⏸️'}</div>
                                  <div className="text-xs text-gray-500">Status</div>
                                  <div className={`text-sm font-semibold ${u.isActive !== false ? 'text-green-600' : 'text-gray-500'}`}>
                                    {u.isActive !== false ? 'Active' : 'Inactive'}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Personal Information */}
							<div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
							  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
								<span className="text-lg">📋</span> Personal Information
							  </h4>
							  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									✉️ Email (Login ID)
								  </label>
								  <input
									type="email"
									value={u.email || ''}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, email: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									placeholder="user@example.com"
								  />
								  {editUserFieldErrors.email && (
									<p className="mt-1 text-xs text-red-600">{editUserFieldErrors.email}</p>
								  )}
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									👤 Full Name
								  </label>
								  <input
									type="text"
									value={u.name}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, name: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
								  />
								  {editUserFieldErrors.name && (
									<p className="mt-1 text-xs text-red-600">{editUserFieldErrors.name}</p>
								  )}
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									📞 Contact Phone Number
								  </label>
								  <input
									type="tel"
									value={u.contactPhoneNumber || u.phone || ''}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, contactPhoneNumber: e.target.value, phone: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									placeholder="(555) 123-4567"
								  />
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									📱 Phone Type
								  </label>
								  <select
									value={u.phoneType || 'Mobile'}
									onChange={(e) => handleSaveUsers(users.map(usr =>
									  usr.id === u.id ? { ...usr, phoneType: e.target.value as 'Mobile' | 'Home' | 'Work' | 'Other', updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
								  >
									<option value="Mobile">Mobile</option>
									<option value="Home">Home</option>
									<option value="Work">Work</option>
									<option value="Other">Other</option>
								  </select>
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									💼 Internal Job Title (Optional)
								  </label>
								  <input
									type="text"
									value={u.jobTitle || ''}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, jobTitle: e.target.value, eventRole: undefined, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									placeholder="e.g. Lead Coordinator, Banquet Director"
								  />
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									🏛️ Department (Optional)
								  </label>
								  <input
									type="text"
									value={u.department || ''}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, department: e.target.value, eventName: undefined, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									placeholder="e.g. Operations, Sales & Events"
								  />
								</div>
							  </div>
							</div>

                            {/* Staff Event Staffing & Shift Assignments */}
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 space-y-4">
                              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                <div>
                                  <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <span>🗓️</span> Booked Wedding Event Assignments
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Assign this internal staff member to work booked wedding events across Seventh Paths Manor.
                                  </p>
                                </div>
                                <span className="text-xs font-bold px-3 py-1 bg-purple-100 text-purple-900 rounded-full border border-purple-200">
                                  {u.assignedEventIds?.length || 0} Event(s) Assigned
                                </span>
                              </div>

                              {coupleEventsList.length === 0 ? (
                                <p className="text-xs text-gray-500 italic py-4 text-center">
                                  No booked couple events exist yet. Create one in Admin → Couples or the Couples Portal first.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {coupleEventsList.map((ev) => {
                                    const isAssigned = u.assignedEventIds?.includes(ev.id);
                                    const assignedRole = u.assignedEventRoles?.[ev.id] || 'Day-of Staff';
                                    const draftRole = selectedEventRoleMap[`${u.id}-${ev.id}`] || assignedRole;

                                    return (
                                      <div
                                        key={ev.id}
                                        className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-all ${
                                          isAssigned
                                            ? 'bg-emerald-50/60 border-emerald-300 shadow-sm'
                                            : 'bg-gray-50/60 border-gray-200 hover:border-gray-300'
                                        }`}
                                      >
                                        <div>
                                          <div className="flex items-center justify-between gap-2 border-b border-gray-200/80 pb-2">
                                            <span className="font-bold text-sm text-gray-900 truncate">{ev.coupleName}</span>
                                            <span
                                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                isAssigned ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                                              }`}
                                            >
                                              {isAssigned ? '✓ Assigned' : 'Unassigned'}
                                            </span>
                                          </div>
                                          <div className="text-xs text-gray-500 mt-2 space-y-1">
                                            <div>📅 {ev.eventDate ? new Date(ev.eventDate).toLocaleDateString() : 'Date TBD'}</div>
                                            <div>👥 {ev.guestCount || 0} Expected Guests</div>
                                          </div>
                                        </div>

                                        <div className="pt-2 border-t border-gray-200/80 space-y-2">
                                          <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Staffing Role</label>
                                            <select
                                              value={draftRole}
                                              onChange={(e) =>
                                                setSelectedEventRoleMap((prev) => ({
                                                  ...prev,
                                                  [`${u.id}-${ev.id}`]: e.target.value,
                                                }))
                                              }
                                              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white"
                                              aria-label={`Role for ${ev.coupleName}`}
                                            >
                                              <option value="Lead Coordinator">Lead Coordinator</option>
                                              <option value="Setup Captain">Setup Captain</option>
                                              <option value="Day-of Staff">Day-of Staff</option>
                                              <option value="Banquet Captain">Banquet Captain</option>
                                              <option value="Audio/Visual Specialist">Audio/Visual Specialist</option>
                                              <option value="Security Lead">Security Lead</option>
                                            </select>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() => handleToggleStaffEventAssignment(u, ev.id, draftRole)}
                                            className={`w-full py-2 rounded-lg text-xs font-bold transition-colors shadow-sm ${
                                              isAssigned
                                                ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                                                : 'text-white'
                                            }`}
                                            style={!isAssigned ? { backgroundColor: config.primaryColor || '#4A1942' } : undefined}
                                          >
                                            {isAssigned ? '✕ Remove Assignment' : '+ Assign to Event →'}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            
                            {/* Account Settings */}
							<div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
							  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
								<span className="text-lg">⚙️</span> Account Settings
							  </h4>
							  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{/* RBAC Role Selection */}
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									🔐 Role (RBAC)
								  </label>
								  <select
									aria-label="Role (RBAC)"
									value={u.assignedRoles?.[0] || u.role || 'staff'}
									onChange={(e) => {
									  const roleId = e.target.value;
									  const selectedRole = allRoles.find(r => r.id === roleId);
									  handleSaveUsers(users.map(usr => 
										usr.id === u.id ? { 
										  ...usr, 
										  assignedRoles: [roleId],
										  role: selectedRole?.hierarchy && selectedRole.hierarchy >= 90 ? 'admin' : 'staff',
										  updatedAt: new Date().toISOString() 
										} : usr
									  ));
									}}
									className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${
									  allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.hierarchy && 
									  allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.hierarchy! >= 90 
										? 'border-purple-300 bg-purple-50' 
										: 'border-blue-300 bg-blue-50'
									}`}
								  >
									{allRoles.filter(role => role.id !== 'basic' && role.id !== 'guest').map(role => (
									  <option key={role.id} value={role.id}>
										{role.name} {role.isImmutable ? '(System)' : role.isSystem ? '(Default)' : '(Custom)'}
									  </option>
									))}
								  </select>
								  <p className="text-xs text-gray-500 mt-1">
									{allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.description}
								  </p>
								</div>
								
								{/* User Status */}
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									📊 User Status
								  </label>
								  <select
									value={u.userStatus || (u.isActive === false ? 'disabled' : 'active')}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { 
										...usr, 
										userStatus: e.target.value as 'invited' | 'pending' | 'active' | 'suspended' | 'disabled',
										isActive: !['suspended', 'disabled'].includes(e.target.value),
										updatedAt: new Date().toISOString() 
									  } : usr
									))}
									className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${
									  (u.userStatus || (u.isActive === false ? 'disabled' : 'active')) === 'active' ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-100'
									}`}
								  >
									<option value="invited">📨 Invited</option>
									<option value="pending">🕒 Pending</option>
									<option value="active">✅ Active</option>
									<option value="suspended">⏸️ Suspended</option>
									<option value="disabled">⛔ Disabled</option>
								  </select>
								</div>
								
								{/* Change Password */}
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									🔒 Change Password
								  </label>
								  <div className="flex gap-2">
									<input
									  type="password"
									  placeholder="New password (min 8 chars)"
									  id={`password-${u.id}`}
									  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									/>
									<button
									  onClick={async () => {
											const input = document.getElementById(`password-${u.id}`) as HTMLInputElement;
											const nextPassword = input.value;
											if (nextPassword.length >= 8) {
											  const passwordRecord = await createPasswordRecord(nextPassword);
											  handleSaveUsers(users.map(usr => 
												usr.id === u.id ? {
												  ...usr,
												  password: '',
												  ...passwordRecord,
												  sessionVersion: ((usr as any).sessionVersion ?? 1) + 1,
												  updatedAt: new Date().toISOString()
												} : usr
											  ));
											  input.value = '';
											  showSuccess('Password updated!');
											} else {
											  showInfo('Password too short', 'Password must be at least 8 characters.', 'warning');
											}
										  }}
									  className="px-4 py-2.5 bg-gradient-to-r from-[#4A1942] to-[#6b2a64] text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium"
									>
									  Update
									</button>
								  </div>
								</div>
							  </div>
							</div>
                            
                            {/* Notes */}
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                                <span className="text-lg">📝</span> Notes
                              </h4>
                              <textarea
                                value={u.notes || ''}
                                onChange={(e) => handleSaveUsers(users.map(usr => 
                                  usr.id === u.id ? { ...usr, notes: e.target.value, updatedAt: new Date().toISOString() } : usr
                                ))}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
                                rows={3}
                                placeholder="Add any additional notes about this user..."
                              />
                            </div>
                            
                            {/* Permissions (for Internal Staff / Shared Users) */}
                            {(u.userRole || (u.role === 'admin' ? 'admin' : 'shared')) !== 'admin' && (
                              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                <h4 className="text-sm font-semibold text-blue-700 flex items-center gap-2 mb-4">
                                  <span className="text-lg">🔐</span> User Permissions
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {[
                                    { key: 'canCreateTemplates', label: 'Create Templates', icon: '📝', desc: 'Can create new layout templates' },
                                    { key: 'canEditTemplates', label: 'Edit Templates', icon: '✏️', desc: 'Can modify existing templates' },
                                    { key: 'canDeleteTemplates', label: 'Delete Templates', icon: '🗑️', desc: 'Can remove templates' },
                                    { key: 'canManageGuests', label: 'Manage Guests', icon: '👥', desc: 'Can add/edit guest lists' },
                                    { key: 'canPrint', label: 'Print Layouts', icon: '🖨️', desc: 'Can print venue layouts' },
                                    { key: 'canExport', label: 'Export Data', icon: '📤', desc: 'Can export layout data' },
                                    { key: 'canViewAllLayouts', label: 'View All Layouts', icon: '👁️', desc: 'Can view layouts from all users' },
                                  ].map(perm => {
                                    const isChecked = u.permissions?.[perm.key as keyof typeof u.permissions] ?? true;
                                    return (
                                      <label 
                                        key={perm.key} 
                                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                          isChecked 
                                            ? 'bg-white border-2 border-blue-300 shadow-sm' 
                                            : 'bg-gray-100 border-2 border-gray-200 opacity-60'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => handleSaveUsers(users.map(usr => 
                                            usr.id === u.id ? { 
                                              ...usr, 
                                              permissions: { 
                                                ...usr.permissions,
                                                [perm.key]: e.target.checked 
                                              },
                                              updatedAt: new Date().toISOString() 
                                            } : usr
                                          ))}
                                          className="w-5 h-5 accent-[#4A1942] mt-0.5"
                                        />
                                        <div>
                                          <div className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                            <span>{perm.icon}</span> {perm.label}
                                          </div>
                                          <div className="text-xs text-gray-500">{perm.desc}</div>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                                <div className="mt-3 flex gap-2">
                                  <button
                                    onClick={() => handleSaveUsers(users.map(usr => 
                                      usr.id === u.id ? { 
                                        ...usr, 
                                        permissions: {
                                          canCreateTemplates: true,
                                          canEditTemplates: true,
                                          canDeleteTemplates: true,
                                          canManageGuests: true,
                                          canPrint: true,
                                          canExport: true,
                                          canViewAllLayouts: true,
                                        },
                                        updatedAt: new Date().toISOString() 
                                      } : usr
                                    ))}
                                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                  >
                                    Grant All
                                  </button>
                                  <button
                                    onClick={() => handleSaveUsers(users.map(usr => 
                                      usr.id === u.id ? { 
                                        ...usr, 
                                        permissions: {
                                          canCreateTemplates: false,
                                          canEditTemplates: false,
                                          canDeleteTemplates: false,
                                          canManageGuests: false,
                                          canPrint: false,
                                          canExport: false,
                                          canViewAllLayouts: false,
                                        },
                                        updatedAt: new Date().toISOString() 
                                      } : usr
                                    ))}
                                    className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                                  >
                                    Revoke All
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            {/* Meta Info Footer */}
                            <div className="bg-gray-100 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3 text-xs text-gray-500">
                              <div className="flex flex-wrap gap-4">
                                <span className="flex items-center gap-1">
                                  <span>📅</span> Created: <strong>{new Date(u.createdAt).toLocaleDateString()}</strong>
                                </span>
                                {u.updatedAt && (
                                  <span className="flex items-center gap-1">
                                    <span>✏️</span> Updated: <strong>{new Date(u.updatedAt).toLocaleDateString()}</strong>
                                  </span>
                                )}
                                {u.createdBy && (
                                  <span className="flex items-center gap-1">
                                    <span>👤</span> By: <strong>{users.find(usr => usr.id === u.createdBy)?.name || u.createdBy}</strong>
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    handleDeleteUser(u.id, u.name || u.email || u.username);
                                  }}
                                  className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                                >
                                  🗑️ Delete User
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
                </div>
                )}
              </div>
              </div>
              )}
              
              {/* Create User Modal */}
			  {showCreateUserModal && (
			    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
				  <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
				    <div
                      className="p-6 border-b border-gray-200 text-white"
                      style={{
                        background: `linear-gradient(135deg, ${config.primaryColor || '#4A1942'}, ${config.primaryDark || '#3d1a45'})`,
                      }}
                    >
					  <h3 className="text-xl font-bold text-white flex items-center gap-2">
					    ➕ Create New User
					  </h3>
				    </div>
				    <div className="p-6 space-y-4">
					  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					    {/* Email - Primary Login Identifier */}
					    <div className="md:col-span-2">
						  <label className="text-xs font-medium text-gray-500 uppercase">Email Address * (Used for login)</label>
						  <input
						    type="email"
						    value={newUser.email || ''}
						    onChange={(e) => {
							  setNewUser({ ...newUser, email: e.target.value });
							  if (createUserFieldErrors.email) {
							    setCreateUserFieldErrors((prev) => ({ ...prev, email: '' }));
							  }
			  			    }}
						    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${createUserFieldErrors.email ? 'border-red-300' : 'border-gray-300'}`}
						    placeholder="user@example.com"
						  />
						  {createUserFieldErrors.email && (
						    <p className="mt-1 text-xs text-red-600">{createUserFieldErrors.email}</p>
						  )}
					      </div>
					  
					    {/* Full Name */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Full Name *</label>
						  <input
						    type="text"
						    value={newUser.name}
						    onChange={(e) => {
							  setNewUser({ ...newUser, name: e.target.value });
							  if (createUserFieldErrors.name) {
							    setCreateUserFieldErrors((prev) => ({ ...prev, name: '' }));
							  }
						    }}
						    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${createUserFieldErrors.name ? 'border-red-300' : 'border-gray-300'}`}
						    placeholder="John Smith"
						  />
						  {createUserFieldErrors.name && (
						    <p className="mt-1 text-xs text-red-600">{createUserFieldErrors.name}</p>
						  )}
					    </div>
					  
					    {/* Password */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Password *</label>
						  <input
						    type="password"
						    value={newUser.password}
						    onChange={(e) => {
							  setNewUser({ ...newUser, password: e.target.value });
							  if (createUserFieldErrors.password) {
							    setCreateUserFieldErrors((prev) => ({ ...prev, password: '' }));
							  }
						    }}
						    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${createUserFieldErrors.password ? 'border-red-300' : 'border-gray-300'}`}
						    placeholder="••••••••"
						  />
						  {createUserFieldErrors.password && (
						    <p className="mt-1 text-xs text-red-600">{createUserFieldErrors.password}</p>
						  )}
					    </div>
					  
					    {/* RBAC Role Selection */}
					    <div className="md:col-span-2">
						  <label className="text-xs font-medium text-gray-500 uppercase">Role * (Controls access permissions)</label>
						  <select
						    aria-label="Role"
						    value={newUser.assignedRoles?.[0] || newUser.role || 'staff'}
						    onChange={(e) => {
							  const roleId = e.target.value;
							  const selectedRole = allRoles.find(r => r.id === roleId);
							  setNewUser({
							    ...newUser,
							    assignedRoles: [roleId],
							    role: selectedRole?.hierarchy && selectedRole.hierarchy >= 90 ? 'admin' : 'staff',
							  });
						    }}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent font-semibold"
						  >
						    {allRoles.filter(role => role.id !== 'basic' && role.id !== 'guest').map(role => (
							  <option key={role.id} value={role.id}>
							    {role.name} {role.isImmutable ? '(System)' : role.isSystem ? '(Default)' : '(Custom)'}
							  </option>
						    ))}
						  </select>
						  <p className="text-xs text-gray-500 mt-1">
						    {allRoles.find(r => r.id === (newUser.assignedRoles?.[0] || newUser.role))?.description}
						  </p>
					    </div>
					  
					    {/* Contact Phone */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Contact Phone</label>
						  <input
						    type="tel"
						    value={newUser.contactPhoneNumber || ''}
						    onChange={(e) => setNewUser({ ...newUser, contactPhoneNumber: e.target.value, phone: e.target.value })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						    placeholder="(555) 123-4567"
						  />
					    </div>
					  
					    {/* Phone Type */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Phone Type</label>
						  <select
						    value={newUser.phoneType || 'Mobile'}
						    onChange={(e) => setNewUser({
							  ...newUser,
							  phoneType: e.target.value as 'Mobile' | 'Home' | 'Work' | 'Other',
						    })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						  >
						    <option value="Mobile">Mobile</option>
						    <option value="Home">Home</option>
						    <option value="Work">Work</option>
						    <option value="Other">Other</option>
						  </select>
					    </div>
					  
					    {/* Internal Job Title */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Internal Job Title (Optional)</label>
						  <input
						    type="text"
						    value={newUser.jobTitle || ''}
						    onChange={(e) => setNewUser({ ...newUser, jobTitle: e.target.value, department: e.target.value })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						    placeholder="e.g. Lead Coordinator, Banquet Manager"
						  />
					    </div>
					  
					    {/* User Status */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">User Status</label>
						  <select
						    value={newUser.userStatus || 'active'}
						    onChange={(e) => setNewUser({
							  ...newUser,
							  userStatus: e.target.value as 'invited' | 'pending' | 'active' | 'suspended' | 'disabled',
						    })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						  >
						    <option value="active">✅ Active</option>
						    <option value="invited">📨 Invited</option>
						    <option value="pending">🕒 Pending</option>
						    <option value="suspended">⏸️ Suspended</option>
						    <option value="disabled">⛔ Disabled</option>
						  </select>
					    </div>
					  </div>
				    </div>
				    <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
					  <button
					    onClick={() => {
						  setShowCreateUserModal(false);
						  setCreateUserFieldErrors({});
						  setNewUser({
						    username: '',
						    password: '',
						    name: '',
						    role: 'staff',
						    email: '',
						    phone: '',
						    contactPhoneNumber: '',
						    phoneType: 'Mobile',
						    preferredCommunication: [],
						    eventRole: '',
						    eventName: '',
						    userRole: 'master',
						    isMasterUser: false,
						    parentUserId: undefined,
						    allowSharedAccess: false,
						    sharedUserLimit: 0,
						    userStatus: 'active',
						    eventDate: '',
						    jobTitle: '',
						    department: '',
						    assignedRoles: [],
						  });
					    }}
					    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
					  >
					    Cancel
					  </button>
					  <button
					    onClick={handleCreateUser}
					    className="btn-primary px-4 py-2 text-white rounded-lg transition-colors font-bold shadow-sm"
                        style={{ backgroundColor: config.primaryColor || '#4A1942' }}
					  >
					    Create User
					  </button>
				    </div>
				  </div>
			    </div>
			  )}

              {/* Staff-to-Event Assignment Command Matrix Modal */}
              {showStaffEventMatrixModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[11000] p-4">
                  <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                    <div
                      className="p-5 border-b border-gray-200 text-white flex items-center justify-between"
                      style={{
                        background: `linear-gradient(135deg, ${config.primaryColor || '#4A1942'}, ${config.primaryDark || '#3d1a45'})`,
                      }}
                    >
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <span>🗓️</span> Staff-to-Event Assignment Command Matrix
                        </h3>
                        <p className="text-xs text-white/80 mt-0.5">
                          Easily assign Admins, Managers, and Staff across all booked wedding events.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowStaffEventMatrixModal(false)}
                        className="p-2 hover:bg-white/20 rounded-lg text-white font-bold transition-colors"
                        aria-label="Close staffing matrix"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 space-y-6">
                      {coupleEventsList.length === 0 ? (
                        <div className="p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                          <div className="text-4xl mb-2">🗓️</div>
                          <h4 className="text-base font-bold text-gray-800">No Booked Events Found</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Create couple events in Admin → Couples or the Couples Portal to begin assigning staff.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {coupleEventsList.map((ev) => (
                            <div key={ev.id} className="rounded-xl border border-gray-200 p-5 bg-white shadow-sm space-y-4">
                              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                <div>
                                  <h4 className="font-bold text-base text-gray-900">{ev.coupleName}</h4>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    📅 {ev.eventDate ? new Date(ev.eventDate).toLocaleDateString() : 'Date TBD'} • 👥 {ev.guestCount || 0} Guests
                                  </p>
                                </div>
                                <span className="text-xs font-bold px-3 py-1 bg-purple-100 text-purple-900 rounded-full">
                                  {users.filter((u) => u.assignedEventIds?.includes(ev.id)).length} Staff Assigned
                                </span>
                              </div>

                              <div className="space-y-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                  Assigned Venue Staff ({users.filter((u) => u.assignedEventIds?.includes(ev.id)).length})
                                </label>
                                {users.filter((u) => u.assignedEventIds?.includes(ev.id)).length === 0 ? (
                                  <p className="text-xs text-gray-400 italic py-2">No venue staff assigned yet.</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {users
                                      .filter((u) => u.assignedEventIds?.includes(ev.id))
                                      .map((u) => (
                                        <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs">
                                          <div>
                                            <span className="font-bold text-gray-900">{u.name}</span>
                                            <span className="text-gray-500 ml-1">
                                              ({u.assignedEventRoles?.[ev.id] || 'Day-of Staff'})
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleToggleStaffEventAssignment(u, ev.id)}
                                            className="text-red-600 font-bold hover:underline"
                                            aria-label={`Remove ${u.name} from ${ev.coupleName}`}
                                          >
                                            Remove ✕
                                          </button>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>

                              <div className="pt-2 border-t border-gray-100 space-y-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                  + Quick Assign Staff Member
                                </label>
                                <div className="flex gap-2">
                                  <select
                                    id={`assign-staff-${ev.id}`}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold bg-white"
                                    aria-label={`Select staff member for ${ev.coupleName}`}
                                    defaultValue=""
                                  >
                                    <option value="" disabled>-- Select Staff Member --</option>
                                    {users
                                      .filter((u) => !u.assignedEventIds?.includes(ev.id) && u.isActive !== false)
                                      .map((u) => (
                                        <option key={u.id} value={u.id}>
                                          {u.name} ({u.jobTitle || u.role})
                                        </option>
                                      ))}
                                  </select>
                                  <select
                                    id={`assign-role-${ev.id}`}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold bg-white"
                                    aria-label={`Select role for ${ev.coupleName}`}
                                    defaultValue="Lead Coordinator"
                                  >
                                    <option value="Lead Coordinator">Lead Coordinator</option>
                                    <option value="Setup Captain">Setup Captain</option>
                                    <option value="Day-of Staff">Day-of Staff</option>
                                    <option value="Banquet Captain">Banquet Captain</option>
                                    <option value="Audio/Visual Specialist">Audio/Visual Specialist</option>
                                    <option value="Security Lead">Security Lead</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const staffSelect = document.getElementById(`assign-staff-${ev.id}`) as HTMLSelectElement;
                                      const roleSelect = document.getElementById(`assign-role-${ev.id}`) as HTMLSelectElement;
                                      if (!staffSelect || !staffSelect.value) {
                                        showInfo('Please select a staff member to assign.', '', 'warning');
                                        return;
                                      }
                                      const targetUser = users.find((u) => u.id === staffSelect.value);
                                      if (targetUser) {
                                        handleToggleStaffEventAssignment(targetUser, ev.id, roleSelect.value);
                                        staffSelect.value = '';
                                      }
                                    }}
                                    className="btn-primary px-4 py-2 text-white rounded-lg text-xs font-bold transition-colors shrink-0 shadow-sm"
                                    style={{ backgroundColor: config.primaryColor || '#4A1942' }}
                                  >
                                    Assign →
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowStaffEventMatrixModal(false)}
                        className="px-6 py-2.5 bg-gray-800 text-white rounded-xl text-xs font-bold hover:bg-gray-900 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}
              </div>
    </div>
  );
}
