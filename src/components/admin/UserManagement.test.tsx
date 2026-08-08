import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserManagement } from './UserManagement';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import type { CoupleEvent, Config } from '../../types';

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

const testCouple: CoupleEvent = {
  id: 'cpl-200',
  coupleName: 'Elena & Marcus',
  eventDate: '2026-11-20',
  guestCount: 200,
  inviteToken: 'token-elena-marcus',
  layoutStatus: 'pending',
  status: 'active',
  venueCoordinationBooked: false,
  availableSpaces: [],
  selectedSpaces: [],
  layoutHistory: [],
  collaborators: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('UserManagement Portal Accounts Tab (#146)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.COUPLE_EVENTS, JSON.stringify([testCouple]));
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
    users: [],
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
    user: { id: 'admin-1', role: 'admin', name: 'Admin' },
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
    submissionWorkflow: { pendingCount: 0, review: () => {} } as any,
    showSuccess: () => {},
    showInfo: () => {},
    confirmAction: () => {},
  };

  it('renders account type tabs and switches to Couples & Guest Portal accounts view', () => {
    render(<UserManagement {...dummyProps} />);

    const portalTabBtn = screen.getByRole('button', {
      name: /couples & guest portal accounts/i,
    });
    expect(portalTabBtn).toBeInTheDocument();

    fireEvent.click(portalTabBtn);

    expect(screen.getByText('Elena & Marcus')).toBeInTheDocument();
    expect(screen.getByText(/token-elena-marcus/i)).toBeInTheDocument();
    expect(screen.getByText(/read-only venue preview/i)).toBeInTheDocument();
  });

  it('toggles Day of Coordination service access for a couple event', () => {
    render(<UserManagement {...dummyProps} />);

    const portalTabBtn = screen.getByRole('button', {
      name: /couples & guest portal accounts/i,
    });
    fireEvent.click(portalTabBtn);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.getByText(/full collaborative timeline/i)).toBeInTheDocument();
  });
});
