import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AdminPanel } from '../AdminPanel';
import { VenueManagement } from './VenueManagement';
import { AdminDecorSection } from '../AdminDecorSection';
import { AccessControlPanel } from './AccessControlPanel';
import { BackupManagement } from './BackupManagement';
import { BrandingManagement } from './BrandingManagement';
import { StudioLayoutsHome } from '../StudioLayoutsHome';
import { VenueDashboard } from '../VenueDashboard';
import { Sidebar } from '../Sidebar';
import { Header } from '../Header';
import CouplesPortal from '../CouplesPortal';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { saveCoupleSession } from '../../services/couples/coupleService';
import type { Config, Venue, User } from '../../types';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      username: 'admin',
      role: 'admin',
      name: 'Admin User',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    isAdmin: true,
    isBasicUser: false,
    isGuest: false,
    login: vi.fn(),
    logout: vi.fn(),
    continueAsGuest: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    getAllUsers: () => [],
    hasPermission: () => true,
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

const testUser: User = {
  id: 'admin-1',
  username: 'admin',
  name: 'Admin User',
  email: 'admin@sevenpathsmanor.com',
  role: 'admin',
  password: 'hashed-password',
  isActive: true,
  createdAt: new Date().toISOString(),
};

const testVenue: Venue = {
  id: 'venue-1',
  name: 'Main Hall',
  width: 60,
  height: 40,
  capacity: 200,
  category: 'reception',
  color: '#FFFFFF',
  borderColor: '#4A1942',
  pattern: 'wood',
  isMaster: true,
};

describe('Venue Portal Design Consistency & Navigation Audit (#164)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const commonProps: any = {
    config: testConfig,
    user: testUser,
    isAdmin: true,
    isStaff: true,
    canAdmin: true,
    canOps: true,
    onClose: vi.fn(),
    onShowSuccess: vi.fn(),
    confirmAction: vi.fn(),
    layoutCategories: [{ id: 'reception', name: 'Reception', color: '#FFF', icon: '🎉', description: 'Reception space' }],
    patternOptions: ['wood', 'grass', 'concrete', 'carpet'],
  };

  it('renders AdminPanel with Branding, Access, & Configuration category and no redundant Dashboard Admin header', () => {
    render(
      <AdminPanel
        onClose={vi.fn()}
        currentLayout={{ tables: [], fixtures: [], venueId: 'venue-1', category: 'reception' }}
        onLoadTemplateForEdit={vi.fn()}
        onOpenVenueMap={vi.fn()}
      />
    );

    expect(screen.getByText('Branding, Access, & Configuration')).toBeInTheDocument();
    expect(screen.queryByText('System Brand & Access')).not.toBeInTheDocument();
  });

  it('renders quick presets in VenueManagement with uniform branding and ⚡ Quick Presets label', () => {
    const props: any = {
      ...commonProps,
      venues: [testVenue],
      handleSaveVenues: vi.fn(),
      expandedVenues: new Set(['venue-1']),
      setExpandedVenues: vi.fn(),
    };

    render(<VenueManagement {...props} />);

    expect(screen.getByText(/⚡ Quick Presets:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ 🎉 Reception/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ 🍸 Cocktail/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ 💒 Ceremony/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ 🏨 Lodging/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ 🍽️ Rehearsal/i })).toBeInTheDocument();
  });

  it('renders AdminDecorSection with compact space-y-4 layout, ⚡ Quick Presets, and Integrated Search bar', () => {
    const props: any = {
      ...commonProps,
      decorItems: [],
      setDecorItems: vi.fn(),
      decorCategories: [
        { id: 'ceremony-florals', name: 'Ceremony Florals', icon: '🌸', color: '#FFB6C1', isCustom: false },
      ],
      setDecorCategories: vi.fn(),
      decorArrangements: [],
      setDecorArrangements: vi.fn(),
      decorPackages: [],
      setDecorPackages: vi.fn(),
    };

    render(<AdminDecorSection {...props} />);

    expect(screen.getByText('Decor & Design Management')).toBeInTheDocument();
    expect(screen.getByText(/⚡ Quick Presets:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ 🌸 Ceremony Florals/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ 🕯️ Centerpieces/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ ✨ Lighting & Drapery/i })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /search decor items/i })).toBeInTheDocument();
  });

  it('renders AccessControlPanel with BrandedSectionHeader and dynamic hierarchy badge styling', () => {
    render(<AccessControlPanel onClose={vi.fn()} inline={true} />);

    expect(screen.getByText('Access Control')).toBeInTheDocument();
    expect(screen.getByText('Manage roles, permissions, and user access across the venue platform')).toBeInTheDocument();
  });

  it('renders uniform executive headers across Home, Calendar, and Couples Portal in VenueDashboard without redundant ← Dashboard Home buttons', () => {
    const props: any = {
      user: testUser,
      isAdmin: true,
      isStaff: true,
      canAdmin: true,
      canOps: true,
      onOpenAdmin: vi.fn(),
      onOpenOperations: vi.fn(),
      onOpenVendorPanel: vi.fn(),
      onOpenTimelinePanel: vi.fn(),
      onLogout: vi.fn(),
    };

    const { rerender } = render(<VenueDashboard {...props} />);

    // Verify Home section executive header
    expect(screen.getByText('Welcome back to Seven Paths Manor')).toBeInTheDocument();

    // Switch to Calendar section via sidebar
    const calBtn = screen.getAllByRole('button', { name: /📅\s*Calendar/i })[0];
    fireEvent.click(calBtn);
    expect(screen.getByRole('heading', { name: /Venue Calendar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /←\s*dashboard home/i })).not.toBeInTheDocument();

    // Switch to Couples Portal section via sidebar
    const couplesBtn = screen.getAllByRole('button', { name: /💍\s*Couples Portal/i })[0];
    fireEvent.click(couplesBtn);
    expect(screen.getByRole('heading', { name: /Couples Portal/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /←\s*dashboard home/i })).not.toBeInTheDocument();
  });

  it('renders BackupManagement with BrandedSectionHeader matching Security & Audit style', () => {
    render(<BackupManagement user={testUser} onDataRestored={vi.fn()} />);

    expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
    expect(
      screen.getByText(/Download a full backup of this workspace/i)
    ).toBeInTheDocument();
  });

  it('renders StudioLayoutsHome with BrandedStatCard metrics and branded active space card', () => {
    render(
      <StudioLayoutsHome
        venues={[testVenue]}
        currentVenueId="venue-1"
        templates={[]}
        layoutCategories={[{ id: 'reception', name: 'Reception', color: '#FFF', icon: '🎉', description: 'Reception space' }]}
        canEdit={true}
        onOpenVenue={vi.fn()}
        onSelectTemplate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Venue spaces')).toBeInTheDocument();
    expect(screen.getByText('Total seating capacity')).toBeInTheDocument();
    expect(screen.getByText('Spaces with a master layout')).toBeInTheDocument();
    expect(screen.getByText('Open now')).toBeInTheDocument();
  });

  it('renders ModalDialog with max-h-[94vh] flex-col container and always-visible header close button preventing top cutoff', () => {
    render(
      <StudioLayoutsHome
        venues={[testVenue]}
        currentVenueId="venue-1"
        templates={[]}
        layoutCategories={[{ id: 'reception', name: 'Reception', color: '#FFF', icon: '🎉', description: 'Reception space' }]}
        canEdit={true}
        onOpenVenue={vi.fn()}
        onSelectTemplate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-h-[94vh]');
    expect(dialog.className).toContain('rounded-2xl');

    const closeBtn = screen.getByRole('button', { name: /close spaces & layouts/i });
    expect(closeBtn).toBeInTheDocument();
  });

  it('renders all main page headers in VenueDashboard with rounded corners (rounded-2xl)', () => {
    const props: any = {
      user: testUser,
      isAdmin: true,
      isStaff: true,
      canAdmin: true,
      canOps: true,
      onOpenAdmin: vi.fn(),
      onOpenOperations: vi.fn(),
      onOpenVendorPanel: vi.fn(),
      onOpenTimelinePanel: vi.fn(),
      onLogout: vi.fn(),
    };

    render(<VenueDashboard {...props} />);

    const homeTitle = screen.getByText('Welcome back to Seven Paths Manor');
    const headerEl = homeTitle.closest('header');
    expect(headerEl?.className).toContain('rounded-2xl');
  });

  it('renders Landing Page sidebar in VenueDashboard with Branding attributes and collapsible mouse-hold resize handle', () => {
    const props: any = {
      user: testUser,
      isAdmin: true,
      isStaff: true,
      canAdmin: true,
      canOps: true,
      onOpenAdmin: vi.fn(),
      onOpenOperations: vi.fn(),
      onOpenVendorPanel: vi.fn(),
      onOpenTimelinePanel: vi.fn(),
      onLogout: vi.fn(),
    };

    render(<VenueDashboard {...props} />);

    // Verify venue name and contact email in Landing Page sidebar
    expect(screen.getAllByText('Seven Paths Manor').length).toBeGreaterThan(0);
    expect(screen.getByTitle('Email: weddings@sevenpathsmanor.com')).toBeInTheDocument();

    // Verify collapse button and mouse-hold resize handle
    expect(screen.getByTitle('Collapse sidebar')).toBeInTheDocument();
    expect(screen.getByTitle('Hold mouse button and drag to resize sidebar')).toBeInTheDocument();
  });

  it('renders CouplesPortal with tasteful Hosted at branding attributes', () => {
    // Save couple session to display overview
    localStorage.setItem(
      STORAGE_KEYS.COUPLE_EVENTS,
      JSON.stringify([
        {
          id: 'event-101',
          coupleName: 'Smith & Johnson',
          eventDate: '2026-06-06',
          guestCount: 120,
          status: 'active',
          inviteToken: 'test-token-101',
          selectedSpaces: ['v1'],
          availableSpaces: ['v1'],
          collaborators: [
            { id: 'collab-101', name: 'John Smith', email: 'john@smith.com', role: 'couple', inviteToken: 'test-token-101' },
          ],
          questions: [],
          layoutStatus: 'approved',
          vendorIds: [],
          timelineDays: [],
        },
      ])
    );
    saveCoupleSession('event-101', 'collab-101');

    render(<CouplesPortal onExitPortal={vi.fn()} />);

    expect(screen.getByText('Hosted at')).toBeInTheDocument();
    expect(screen.getByTitle('Email venue coordinator: weddings@sevenpathsmanor.com')).toBeInTheDocument();
    expect(screen.getByTitle('Visit venue website: https://www.sevenpathsmanor.com')).toBeInTheDocument();
  });

  it('renders Layout Studio Header with Venue Map and Spaces & Layouts buttons, Ops & Admin in menu, and no Templates or Sign out in menu', () => {
    const onShowSpacesLayouts = vi.fn();
    const onOpenVenueMap = vi.fn();
    const onShowAdmin = vi.fn();
    const onOpenOperations = vi.fn();

    render(
      <Header
        currentVenue={testVenue}
        venues={[testVenue]}
        selectedVenueCategories={[]}
        onChangeVenue={vi.fn()}
        onChangeVenueCategories={vi.fn()}
        onSaveLayout={vi.fn()}
        onSaveMasterLayout={vi.fn()}
        onClearMasterLayout={vi.fn()}
        onPrint={vi.fn()}
        onShowTemplates={vi.fn()}
        onShowSpacesLayouts={onShowSpacesLayouts}
        onOpenVenueMap={onOpenVenueMap}
        onShowAdmin={onShowAdmin}
        onOpenOperations={onOpenOperations}
        onShowDashboard={vi.fn()}
        onLogout={vi.fn()}
        userName="Jane"
        isAdmin={true}
        isStaff={true}
        savedLayouts={[]}
        onLoadSavedLayout={vi.fn()}
        onDeleteSavedLayout={vi.fn()}
        mobileMenuOpen={false}
        setMobileMenuOpen={vi.fn()}
        currentUser={testUser}
      />
    );

    // Verify Venue Map and Spaces & Layouts buttons on left side of Header
    expect(screen.getByRole('button', { name: /Spaces & Layouts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Venue Map/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to Home/i })).toBeInTheDocument();

    // Open administrative Menu
    const menuBtn = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuBtn);

    // Verify Admin and Ops are inside menu
    expect(screen.getByTitle('Admin & System Settings')).toBeInTheDocument();
    expect(screen.getByTitle('Operations Studio')).toBeInTheDocument();

    // Verify Templates and Sign out are NOT in menu
    expect(screen.queryByText(/Templates/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sign out/i)).not.toBeInTheDocument();
  });

  it('renders Email link with word Email in Landing Page left sidebar and omits system settings from Home header', () => {
    const props: any = {
      user: testUser,
      isAdmin: true,
      isStaff: true,
      canAdmin: true,
      canOps: true,
      onOpenAdmin: vi.fn(),
      onOpenOperations: vi.fn(),
      onOpenVendorPanel: vi.fn(),
      onOpenTimelinePanel: vi.fn(),
      onLogout: vi.fn(),
    };

    render(<VenueDashboard {...props} />);

    expect(screen.getByTitle('Email: weddings@sevenpathsmanor.com')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();

    const homeTitle = screen.getByText('Welcome back to Seven Paths Manor');
    const headerEl = homeTitle.closest('header')!;
    expect(within(headerEl).queryByRole('button', { name: /system settings/i })).not.toBeInTheDocument();
  });

  it('renders BrandingManagement with Live Preview heading and logo file upload input that saves logoUrl', async () => {
    const handleSaveConfig = vi.fn();
    const showSuccess = vi.fn();

    render(
      <BrandingManagement
        {...commonProps}
        config={testConfig}
        handleSaveConfig={handleSaveConfig}
        showSuccess={showSuccess}
        expandedBrandingSections={new Set(['logo', 'preview'])}
        setExpandedBrandingSections={vi.fn()}
      />
    );

    expect(screen.getByText('👁️ Live Preview')).toBeInTheDocument();
    expect(screen.getByText('Upload Logo')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://example.com/logo.png')).toBeInTheDocument();

    const fileInput = screen.getByLabelText(/Upload logo image file/i);
    expect(fileInput).toBeInTheDocument();
    const file = new File(['(binary)'], 'logo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await vi.waitFor(() => {
      expect(handleSaveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          logoUrl: expect.stringContaining('data:image/png'),
        })
      );
    });
    expect(showSuccess).toHaveBeenCalledWith('Logo uploaded successfully!');
  });
});
