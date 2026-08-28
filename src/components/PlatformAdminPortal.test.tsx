import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformConsoleMetrics, PlatformOrganizationSummary } from '../services/platform/platformTypes';

const listOrganizationsMock = vi.fn();
const metricsMock = vi.fn();
const auditMock = vi.fn();
const updateVenueMock = vi.fn();
const geocodeMock = vi.fn();
const logoutMock = vi.fn();
const authState = {
  user: { email: 'platform@example.com', name: 'Platform Admin' },
  organizationId: null,
  organizationSlug: null,
  hasVenueSession: false,
  logout: logoutMock,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../services/platform/platformAdminService', () => ({
  listPlatformOrganizations: (...args: unknown[]) => listOrganizationsMock(...args),
  getPlatformConsoleMetrics: (...args: unknown[]) => metricsMock(...args),
  listPlatformAuditLogs: (...args: unknown[]) => auditMock(...args),
  updateVenueOrganization: (...args: unknown[]) => updateVenueMock(...args),
  createVenueOrganization: vi.fn(),
  reactivateVenueOrganization: vi.fn(),
  reissueVenueAdminInvite: vi.fn(),
  revokeVenueAdminInvite: vi.fn(),
  suspendVenueOrganization: vi.fn(),
  venueLifecycleUpdateInput: (organization: PlatformOrganizationSummary, status: PlatformOrganizationSummary['status']) => ({
    organizationId: organization.id,
    name: organization.name,
    status,
    addressLine1: organization.addressLine1 || '',
    addressLine2: organization.addressLine2 || '',
    city: organization.city || '',
    stateRegion: organization.stateRegion || '',
    postalCode: organization.postalCode || '',
    country: organization.country || 'US',
    primaryContactName: organization.primaryContactName || '',
    primaryContactPhone: organization.primaryContactPhone || '',
    primaryContactEmail: organization.primaryContactEmail || '',
    supportEmail: organization.supportEmail || '',
    phone: organization.phone || '',
    websiteUrl: organization.websiteUrl || '',
    latitude: organization.latitude ?? null,
    longitude: organization.longitude ?? null,
    suspensionReason: organization.suspensionReason || '',
  }),
}));

vi.mock('../services/platform/platformBrandingService', () => ({
  getPlatformBranding: () => Promise.resolve({}),
  savePlatformBranding: vi.fn(),
}));

vi.mock('../services/platform/geocodingService', () => ({
  geocodeVenueAddress: (...args: unknown[]) => geocodeMock(...args),
}));

vi.mock('./PlatformVenueChatPanel', () => ({
  default: ({ organizationName }: { organizationName?: string }) => <div>Chat stub {organizationName}</div>,
}));

vi.mock('./PlatformVenueMap', () => ({
  default: ({ onOpenVenue }: { onOpenVenue?: (id: string) => void }) => (
    <div>
      Map stub
      <button type="button" onClick={() => onOpenVenue?.('org-1')}>Open / edit</button>
    </div>
  ),
}));

vi.mock('./Toast', () => ({
  showToast: vi.fn(),
}));

import PlatformAdminPortal from './PlatformAdminPortal';

function org(over: Partial<PlatformOrganizationSummary> = {}): PlatformOrganizationSummary {
  return {
    id: 'org-1',
    name: 'Seven Paths Manor',
    slug: 'seven-paths-manor',
    status: 'active',
    ownerId: 'u1',
    city: 'Charlotte',
    stateRegion: 'NC',
    country: 'US',
    addressLine1: '100 Manor Rd',
    postalCode: '28202',
    primaryContactName: 'Ada',
    primaryContactEmail: 'ada@sevenpaths.com',
    primaryContactPhone: '704-555-0100',
    latitude: 35.227,
    longitude: -80.843,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    admins: [{ userId: 'u1', email: 'ada@sevenpaths.com', fullName: 'Ada Lovelace', role: 'owner', status: 'active' }],
    ...over,
  };
}

const organizations: PlatformOrganizationSummary[] = [
  org(),
  org({
    id: 'org-2',
    name: 'Hilltop Barn',
    slug: 'hilltop-barn',
    status: 'provisioning',
    city: 'Asheville',
    primaryContactEmail: 'owner@hilltop.com',
    ownerId: null,
    pendingInvite: { id: 'inv-2', email: 'owner@hilltop.com', expiresAt: '2026-09-01T00:00:00.000Z', status: 'pending' },
    admins: [],
  }),
];

const metrics: PlatformConsoleMetrics = {
  totalVenues: 2,
  activeVenues: 1,
  suspendedVenues: 0,
  provisioningVenues: 1,
  pendingInvites: 1,
  activeAdmins: 1,
  totalCouples: 4,
  totalGuests: 80,
  totalRsvps: 20,
  venues: [
    {
      id: 'org-1',
      name: 'Seven Paths Manor',
      slug: 'seven-paths-manor',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      adminCount: 1,
      coupleCount: 3,
      guestCount: 60,
      rsvpCount: 15,
      pendingInviteCount: 0,
    },
    {
      id: 'org-2',
      name: 'Hilltop Barn',
      slug: 'hilltop-barn',
      status: 'provisioning',
      createdAt: '2026-02-01T00:00:00.000Z',
      adminCount: 0,
      coupleCount: 1,
      guestCount: 20,
      rsvpCount: 5,
      pendingInviteCount: 1,
    },
  ],
};

describe('PlatformAdminPortal console', () => {
  beforeEach(() => {
    window.location.hash = '#/platform-admin';
    authState.hasVenueSession = false;
    listOrganizationsMock.mockReset().mockResolvedValue(organizations);
    metricsMock.mockReset().mockResolvedValue(metrics);
    auditMock.mockReset().mockResolvedValue([
      {
        id: 'log-1',
        platformUserId: 'u1',
        actorEmail: 'punistricker@gmail.com',
        actorName: 'Platform Admin',
        organizationId: 'org-1',
        action: 'venue_updated',
        targetType: 'organization',
        targetId: 'org-1',
        reason: null,
        metadata: {},
        createdAt: '2026-08-19T12:00:00.000Z',
      },
    ]);
    updateVenueMock.mockReset().mockResolvedValue({
      organizationId: 'org-1',
      organizationName: 'Seven Paths Estate',
      organizationSlug: 'seven-paths-manor',
      status: 'active',
    });
    geocodeMock.mockReset();
    logoutMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a sidebar of console areas', async () => {
    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);

    const nav = await screen.findByRole('navigation', { name: 'Platform console' });
    for (const label of ['Overview', 'Venues', 'Map', 'Onboard venue', 'Branding', 'Chat', 'Audit']) {
      expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText(/venue intelligence platform console/i)).toBeInTheDocument();
  });

  it('deep-links overview KPIs into a filtered venue directory', async () => {
    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);

    const pending = await screen.findByRole('button', { name: /pending invites/i });
    fireEvent.click(pending);
    expect(window.location.hash).toBe('#/platform-admin/venues?queue=pending-invite');
    await waitFor(() => {
      expect(screen.getByText('Hilltop Barn')).toBeInTheDocument();
      expect(screen.queryByText('Seven Paths Manor')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Invite pending')).toBeInTheDocument();
  });

  it('shows a venue-session card only when a venue login exists', async () => {
    const { unmount } = render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);
    await screen.findByRole('navigation', { name: 'Platform console' });
    expect(screen.queryByText(/this browser also has a venue login/i)).not.toBeInTheDocument();
    unmount();
    authState.hasVenueSession = true;
    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);
    expect(await screen.findByText(/this browser also has a venue login/i)).toBeInTheDocument();
    expect(screen.getByText(/does not replace your platform login/i)).toBeInTheDocument();
  });

  it('filters the venue directory by name and opens a detail/edit view', async () => {
    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);

    const nav = await screen.findByRole('navigation', { name: 'Platform console' });
    fireEvent.click(within(nav).getByRole('button', { name: 'Venues' }));

    await waitFor(() => {
      expect(screen.getByText('Seven Paths Manor')).toBeInTheDocument();
      expect(screen.getByText('Hilltop Barn')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'hilltop' } });
    expect(screen.queryByText('Seven Paths Manor')).not.toBeInTheDocument();
    expect(screen.getByText('Hilltop Barn')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open / edit' }));

    await waitFor(() => {
      expect(screen.getByText(/slug is immutable: hilltop-barn/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/venue name/i)).toHaveValue('Hilltop Barn');
    expect(screen.getByLabelText(/invite email/i)).toHaveValue('owner@hilltop.com');
    expect(screen.getByRole('button', { name: /save venue changes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /activate venue/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^status$/i)).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/platform-admin/venues/org-2');
  });

  it('activates a provisioning venue without waiting on a hung console reload', async () => {
    window.location.hash = '#/platform-admin/venues/org-2';
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    listOrganizationsMock
      .mockResolvedValueOnce(organizations)
      .mockImplementation(() => new Promise(() => {}));
    metricsMock
      .mockResolvedValueOnce(metrics)
      .mockImplementation(() => new Promise(() => {}));
    updateVenueMock.mockResolvedValue({
      organizationId: 'org-2',
      organizationName: 'Hilltop Barn',
      organizationSlug: 'hilltop-barn',
      status: 'active',
    });

    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);

    const activate = await screen.findByRole('button', { name: /activate venue/i });
    fireEvent.click(activate);

    await waitFor(() => {
      expect(updateVenueMock).toHaveBeenCalledTimes(1);
    });
    expect(geocodeMock).not.toHaveBeenCalled();
    expect(updateVenueMock.mock.calls[0][0]).toMatchObject({
      organizationId: 'org-2',
      status: 'active',
      name: 'Hilltop Barn',
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activate venue/i })).toBeEnabled();
    });
    expect(screen.queryByRole('button', { name: /saving/i })).not.toBeInTheDocument();
  });

  it('saves venue identity edits without re-geocoding an unchanged address', async () => {
    window.location.hash = '#/platform-admin/venues/org-1';
    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);

    const nameInput = await screen.findByLabelText(/venue name/i);
    fireEvent.change(nameInput, { target: { value: 'Seven Paths Estate' } });
    fireEvent.click(screen.getByRole('button', { name: /save venue changes/i }));

    await waitFor(() => {
      expect(updateVenueMock).toHaveBeenCalledTimes(1);
    });
    expect(geocodeMock).not.toHaveBeenCalled();
    expect(updateVenueMock.mock.calls[0][0]).toMatchObject({
      organizationId: 'org-1',
      name: 'Seven Paths Estate',
      status: 'active',
      latitude: 35.227,
      longitude: -80.843,
    });
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('collects contact first and last name on the onboard form', async () => {
    window.location.hash = '#/platform-admin/onboard';
    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);
    expect(await screen.findByLabelText(/contact first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact last name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^contact name/i)).not.toBeInTheDocument();
  });

  it('shows platform audit actions and actor on the Audit screen', async () => {
    window.location.hash = '#/platform-admin/audit';
    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);

    expect(await screen.findByText('venue_updated')).toBeInTheDocument();
    expect(screen.getByText('Seven Paths Manor')).toBeInTheDocument();
    expect(screen.getByText(/platform admin · punistricker@gmail.com/i)).toBeInTheDocument();
  });

  it('shows venues even if console metrics never return', async () => {
    metricsMock.mockImplementation(() => new Promise(() => {}));
    auditMock.mockImplementation(() => new Promise(() => {}));
    window.location.hash = '#/platform-admin/venues';
    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);

    expect(await screen.findByText('Seven Paths Manor')).toBeInTheDocument();
    expect(screen.getByText('Hilltop Barn')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Open / edit' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/couples: —/i).length).toBeGreaterThan(0);
  });

  it('does not show zero couple KPIs while metrics are pending', async () => {
    metricsMock.mockImplementation(() => new Promise(() => {}));
    window.location.hash = '#/platform-admin';
    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);

    expect(await screen.findByRole('button', { name: /—\s*couples/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^0\s*couples$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1\s*managed admins/i })).toBeInTheDocument();
  });

  it('opens venue detail from the map Open / edit action', async () => {
    window.location.hash = '#/platform-admin/map';
    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open / edit' }));
    expect(window.location.hash).toBe('#/platform-admin/venues/org-1');
  });
});
