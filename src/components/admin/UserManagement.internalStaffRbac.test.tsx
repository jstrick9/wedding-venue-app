import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserManagement } from './UserManagement';
import { AccessControlPanel } from './AccessControlPanel';
import type { Config } from '../../types';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', role: 'admin', name: 'Sarah Admin' },
  }),
}));

const testConfig: Config = {
  logoUrl: '',
  venueName: 'Seven Paths Manor',
  tagline: 'Weddings Reimagined',
  location: 'Spring Hope, NC',
  websiteUrl: 'https://www.sevenpathsmanor.com',
  supportEmail: 'weddings@sevenpathsmanor.com',
  phone: '',
  primaryColor: '#4A1942',
  primaryDark: '#3d1a45',
  primaryLight: '#6b2c5c',
  accentColor: '#8B5A8B',
  backgroundColor: '#f3f4f6',
  textColor: '#1f2937',
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  headerTextColor: '#FFFFFF',
  bodyTextColor: '#374151',
  accentTextColor: '#4A1942',
};

describe('UserManagement & AccessControl — Internal Staff RBAC & Zero-Event-Tying (#160)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const dummyProps: any = {
    config: testConfig,
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
      {
        id: 'staff-1',
        username: 'coordinator',
        email: 'coordinator@sevenpathsmanor.com',
        name: 'John Staff',
        role: 'staff',
        assignedRoles: ['staff'],
        jobTitle: 'Lead Coordinator',
        department: 'Operations',
        isActive: true,
        createdAt: '2026-01-02T00:00:00.000Z',
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
    setShowCreateUserModal: () => {},
    setShowEditUserModal: () => {},
    setEditingUser: () => {},
    handleSaveUsers: () => {},
    handleDeleteUser: () => {},
    handleImpersonate: () => {},
    submissionWorkflow: { pendingCount: 0, review: () => {}, submissions: [] } as any,
    showUserAccountsSection: true,
    setShowUserAccountsSection: vi.fn(),
    expandedUsers: new Set(['staff-1', 'admin-1']),
    setExpandedUsers: vi.fn(),
    getUserFieldErrors: () => ({}),
    createUserFieldErrors: {},
    setCreateUserFieldErrors: vi.fn(),
    allRoles: [
      { id: 'master-admin', name: 'Master Admin', hierarchy: 100, isSystem: true, isImmutable: true },
      { id: 'admin', name: 'Admin', hierarchy: 90, isSystem: true },
      { id: 'manager', name: 'Manager', hierarchy: 70, isSystem: true },
      { id: 'basic', name: 'Basic User', hierarchy: 50, isSystem: true },
      { id: 'staff', name: 'Staff', hierarchy: 40, isSystem: true },
      { id: 'guest', name: 'Guest', hierarchy: 10, isSystem: true },
    ],
    showSuccess: () => {},
    showInfo: () => {},
    confirmAction: () => {},
  };

  it('renders internal staff operational stat cards and excludes legacy Manage Event Roles section', () => {
    render(<UserManagement {...dummyProps} />);

    // Verify clean operational stat cards appear
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Operations Staff')).toBeInTheDocument();
    expect(screen.getByText('Administrators')).toBeInTheDocument();

    // Verify legacy "Manage Event Roles" button/section is completely removed
    expect(screen.queryByText(/Manage Event Roles/i)).toBeNull();
  });

  it('filters out legacy basic and guest roles from RBAC role dropdowns when creating or editing internal staff', () => {
    render(<UserManagement {...dummyProps} />);

    // Find the RBAC role select dropdown
    const selectEl = screen.getAllByRole('combobox', { name: /Role \(RBAC\)/i })[0];
    const optionTexts = Array.from(selectEl.querySelectorAll('option')).map((o) => o.textContent);

    expect(optionTexts.some((text) => /Admin/i.test(text || ''))).toBe(true);
    expect(optionTexts.some((text) => /Manager/i.test(text || ''))).toBe(true);
    expect(optionTexts.some((text) => /Staff/i.test(text || ''))).toBe(true);

    // Verify legacy 'basic' and 'guest' roles are excluded from Internal Staff RBAC choices
    expect(optionTexts.some((text) => /Basic User/i.test(text || ''))).toBe(false);
    expect(optionTexts.some((text) => /Guest/i.test(text || ''))).toBe(false);
  });

  it('displays the Manager role (hierarchy: 70) and hierarchy badges in AccessControlPanel', () => {
    render(<AccessControlPanel onClose={() => {}} inline={true} />);

    // Verify default system roles include Manager
    expect(screen.getByText('Master Admin')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();

    // Select the Manager role and check that its hierarchy badge is displayed
    fireEvent.click(screen.getByText('Manager'));
    expect(screen.getByText(/Hierarchy: 70/i)).toBeInTheDocument();
    expect(screen.getByText(/Internal Staff Role/i)).toBeInTheDocument();
  });
});
