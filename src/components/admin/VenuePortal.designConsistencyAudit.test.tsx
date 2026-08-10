import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminPanel } from '../AdminPanel';
import { VenueManagement } from './VenueManagement';
import { AdminDecorSection } from '../AdminDecorSection';
import { AccessControlPanel } from './AccessControlPanel';
import { VenueDashboard } from '../VenueDashboard';
import { STORAGE_KEYS } from '../../constants/storageKeys';
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
    layoutCategories: [{ id: 'reception', name: 'Reception', color: '#FFF', icon: '🎉' }],
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
});
