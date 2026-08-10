import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserManagement } from './UserManagement';
import { AccessControlPanel } from './AccessControlPanel';
import type { Config } from '../../types';

const emeraldConfig: Config = {
  logoUrl: '',
  venueName: 'Emerald Manor',
  tagline: 'Weddings Reimagined',
  location: 'Spring Hope, NC',
  websiteUrl: 'https://www.sevenpathsmanor.com',
  supportEmail: 'weddings@sevenpathsmanor.com',
  phone: '',
  primaryColor: '#10b981',
  primaryDark: '#047857',
  primaryLight: '#34d399',
  accentColor: '#059669',
  backgroundColor: '#f8fafc',
  textColor: '#1e293b',
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  headerTextColor: '#FFFFFF',
  bodyTextColor: '#334155',
  accentTextColor: '#10b981',
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', role: 'admin', name: 'Sarah Admin' },
  }),
}));

vi.mock('../../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config')>();
  return {
    ...actual,
    useBrandingConfig: () => emeraldConfig,
  };
});

describe('Venue Portal (#/admin) — Exhaustive Universal Branding Integration (#162)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const baseProps: any = {
    config: emeraldConfig,
    venues: [],
    setVenues: () => {},
    tables: [],
    setTables: () => {},
    fixtures: [],
    setFixtures: () => {},
    chairs: [],
    setChairs: () => {},
    wallStyles: [],
    setWallStyles: () => {},
    linenColors: [],
    setLinenColors: () => {},
    templates: [],
    setTemplates: () => {},
    guidelines: [],
    setGuidelines: () => {},
    users: [
      {
        id: 'admin-1',
        username: 'admin',
        email: 'admin@sevenpathsmanor.com',
        name: 'Sarah Admin',
        role: 'admin',
        assignedRoles: ['admin'],
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    setUsers: () => {},
    eventQuestions: [],
    setEventQuestions: () => {},
    decorItems: [],
    setDecorItems: () => {},
    decorCategories: [],
    setDecorCategories: () => {},
    decorArrangements: [],
    setDecorArrangements: () => {},
    decorPackages: [],
    setDecorPackages: () => {},
    layoutState: {} as any,
    directMessages: { unreadCountForRole: () => 0 } as any,
    handlers: {} as any,
    user: { id: 'admin-1', role: 'admin', name: 'Sarah Admin' },
    isAdmin: true,
    selectedMessageMasterUserId: '',
    setSelectedMessageMasterUserId: () => {},
    buildMessageThreadId: () => 'thread-1',
    setShowEditUserModal: () => {},
    setEditingUser: () => {},
    handleSaveUsers: () => {},
    handleDeleteUser: () => {},
    handleImpersonate: () => {},
    submissionWorkflow: { pendingCount: 0, review: () => {}, submissions: [] } as any,
    showUserAccountsSection: true,
    setShowUserAccountsSection: vi.fn(),
    expandedUsers: new Set(),
    setExpandedUsers: vi.fn(),
    getUserFieldErrors: () => ({}),
    newUser: { username: '', password: '', name: '', role: 'staff', email: '' },
    setNewUser: vi.fn(),
    createUserFieldErrors: {},
    setCreateUserFieldErrors: vi.fn(),
    allRoles: [
      { id: 'master-admin', name: 'Master Admin', hierarchy: 100, isSystem: true, isImmutable: true },
      { id: 'admin', name: 'Admin', hierarchy: 90, isSystem: true },
      { id: 'manager', name: 'Manager', hierarchy: 70, isSystem: true },
      { id: 'staff', name: 'Staff', hierarchy: 40, isSystem: true },
    ],
    showSuccess: () => {},
    showInfo: () => {},
    confirmAction: () => {},
  };

  it('applies configured branding (#10b981) to + Add User button and Assign Staff button in UserManagement', () => {
    render(<UserManagement {...baseProps} setShowCreateUserModal={() => {}} />);

    // 1. Verify + Add User button has inline background gradient matching primaryColor (#10b981) and primaryDark (#047857)
    const addUserBtn = screen.getByRole('button', { name: /Add User/i });
    expect(addUserBtn.getAttribute('style')).toContain('linear-gradient(135deg, rgb(16, 185, 129), rgb(4, 120, 87))');

    // 2. Verify Assign Staff to Events button has inline color matching primaryColor (#10b981)
    const assignStaffBtn = screen.getByRole('button', { name: /Assign Staff to Events/i });
    expect(assignStaffBtn.getAttribute('style')).toContain('color: rgb(16, 185, 129)');
  });

  it('applies configured branding to Create New User Modal header gradient and Create User submit button', () => {
    function TestWrapper() {
      const [showModal, setShowModal] = useState(false);
      return <UserManagement {...baseProps} showCreateUserModal={showModal} setShowCreateUserModal={setShowModal} />;
    }
    render(<TestWrapper />);

    // Click + Add User to launch modal
    fireEvent.click(screen.getByRole('button', { name: /Add User/i }));

    expect(screen.getByText(/Create New User/i)).toBeInTheDocument();

    // 1. Verify Create User submit button has inline background-color matching primaryColor
    const submitBtn = screen.getByRole('button', { name: /^Create User$/i });
    expect(submitBtn.getAttribute('style')).toContain('background-color: rgb(16, 185, 129)');

    // 2. Verify modal header has inline gradient
    const headerEl = screen.getByText(/Create New User/i).parentElement;
    expect(headerEl?.getAttribute('style')).toContain('linear-gradient(135deg, rgb(16, 185, 129), rgb(4, 120, 87))');
  });

  it('applies configured branding to AccessControlPanel header gradient and + Create Role button', () => {
    render(<AccessControlPanel onClose={() => {}} inline={true} />);

    // 1. Verify header has inline gradient matching primaryColor (#10b981) and primaryDark (#047857)
    const titleEl = screen.getByText('🔐 Access Control');
    const headerEl = titleEl.parentElement?.parentElement;
    expect(headerEl?.getAttribute('style')).toContain('linear-gradient(135deg, rgb(16, 185, 129), rgb(4, 120, 87))');

    // 2. Verify + Create Role button uses inline background-color matching primaryColor
    const createRoleBtn = screen.getByRole('button', { name: /Create Role/i });
    expect(createRoleBtn.getAttribute('style')).toContain('background-color: rgb(16, 185, 129)');
  });
});
