import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformConsoleMetrics, PlatformOrganizationSummary } from '../services/platform/platformTypes';

const listOrganizationsMock = vi.fn();
const metricsMock = vi.fn();
const auditMock = vi.fn();
const updateVenueMock = vi.fn();
const geocodeMock = vi.fn();
const logoutMock = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'platform@example.com', name: 'Platform Admin' },
    organizationId: null,
    logout: logoutMock,
  }),
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
  default: () => <div>Map stub</div>,
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
    pendingInvite: { id: 'inv-2', email: 'owner@hilltop.com', expiresAt: '2026-09-01', status: 'pending' },
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
    listOrganizationsMock.mockReset().mockResolvedValue(organizations);
    metricsMock.mockReset().mockResolvedValue(metrics);
    auditMock.mockReset().mockResolvedValue([
      {
        id: 'log-1',
        platformUserId: 'u1',
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

  it('renders a sidebar of console areas', async () => {
    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);

    const nav = await screen.findByRole('navigation', { name: 'Platform console' });
    for (const label of ['Overview', 'Venues', 'Map', 'Onboard venue', 'Branding', 'Chat', 'Audit']) {
      expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText(/venue intelligence platform console/i)).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /save venue changes/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/platform-admin/venues/org-2');
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

  it('shows platform audit actions on the Audit screen', async () => {
    window.location.hash = '#/platform-admin/audit';
    render(<PlatformAdminPortal onOpenVenueWorkspace={() => {}} />);

    expect(await screen.findByText('venue_updated')).toBeInTheDocument();
    expect(screen.getByText('Seven Paths Manor')).toBeInTheDocument();
  });
});
