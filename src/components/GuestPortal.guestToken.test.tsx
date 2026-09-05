import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/guestPortal', () => ({
  clearGuestPortalSession: vi.fn(),
  celebrationStatusDays: (startDate: unknown, endDate: unknown, isMultiDay: boolean) => {
    if (!startDate) return null;
    const now = Date.now();
    const start = new Date(startDate as string).getTime();
    const end = isMultiDay && endDate ? new Date(endDate as string).getTime() : start;
    if (!Number.isNaN(end) && now > end) return -1;
    if (now >= start) return 0;
    return Math.ceil((start - now) / 86400000);
  },
  getGuestPortalConfig: vi.fn(),
  getPortalGuests: vi.fn(() => []),
  getPortalGuestsForEvent: vi.fn(() => []),
  getPortalRSVPSubmissions: vi.fn(() => []),
  getPortalRSVPSubmissionsForEvent: vi.fn(() => []),
  getPortalVenues: vi.fn(() => []),
  loadGuestPortalSession: vi.fn(() => null),
  saveGuestPortalSession: vi.fn(),
  setPortalRSVPSubmissions: vi.fn(),
  findGuestInEvent: vi.fn(),
  isGuestPortalEventActive: vi.fn(() => true),
  normalizeEventKey: (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
}));

vi.mock('../utils/auth', () => ({ verifySecret: vi.fn() }));
vi.mock('../services/couples/coupleService', () => ({
  findCoupleEventById: vi.fn(() => ({ id: 'e1', coupleName: 'Smith & Johnson', selectedSpaces: ['ceremony'] })),
}));
vi.mock('../services/couples/coupleRsvpService', () => ({
  getCoupleRsvpSubmissions: vi.fn(() => []),
  setCoupleRsvpSubmissions: vi.fn(),
}));
vi.mock('../services/couples/coupleGuestService', () => ({
  getCoupleGuests: vi.fn(),
  getCouplePortalConfig: vi.fn(() => ({
    eventTitle: 'Smith & Johnson',
    eventStartDate: '2026-06-06',
    showRSVP: true,
  })),
}));
vi.mock('../services/wayfinding/venueWayfindingService', () => ({
  getVenueMapConfig: vi.fn(() => null),
  getVenueRules: vi.fn(() => ({ rules: [] })),
  normalizeVenueMapConfig: vi.fn((value: unknown) => value),
  coupleWayfindingPoints: vi.fn(() => []),
  routePolyline: vi.fn(() => []),
}));
vi.mock('../services/weather/venueWeatherService', () => ({
  getVenueWeather: vi.fn(() => ({ forecasts: {} })),
  eventDates: vi.fn(() => []),
}));

import GuestPortal from './GuestPortal';
import * as guestPortalHelpers from '../utils/guestPortal';
import * as coupleGuestService from '../services/couples/coupleGuestService';
import * as coupleRsvpService from '../services/couples/coupleRsvpService';
import * as wayfindingService from '../services/wayfinding/venueWayfindingService';

describe('GuestPortal legacy token compatibility when cloud accounts are unavailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Smith & Johnson',
      eventStartDate: '2026-06-06',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: true,
      showLodging: false,
    } as any);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(true);
    vi.mocked(coupleGuestService.getCoupleGuests).mockReturnValue([
      { id: 'g1', name: 'Jane', token: 'tok-123', eventName: 'e1' },
    ] as any);
  });

  it('retains historical token auto-identification only in local/legacy mode', async () => {
    render(<GuestPortal guestToken="tok-123" coupleEventId="e1" onExitPortal={() => {}} />);

    // With Supabase/account migration intentionally unavailable in this suite,
    // the historical compatibility path bypasses the old identifier form.
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('jane@example.com or Jane Smith')).toBeNull();
    });
    // And the guest token triggered a session save.
    await waitFor(() => {
      expect(guestPortalHelpers.saveGuestPortalSession).toHaveBeenCalled();
    });
    // The authenticated identity must continue to come from the couple-scoped
    // guest store, not the legacy venue-wide portal store.
    expect(screen.getAllByText('Jane').length).toBeGreaterThan(0);
  });

  it('uses couple-scoped RSVP submissions instead of the legacy venue RSVP store', async () => {
    vi.mocked(coupleRsvpService.getCoupleRsvpSubmissions).mockReturnValue([
      {
        id: 'r1',
        guestId: 'g1',
        eventKey: 'e1',
        eventName: 'e1',
        fullName: 'Jane',
        email: 'jane@example.com',
        attending: true,
        submittedAt: new Date().toISOString(),
      },
    ] as any);

    render(<GuestPortal guestToken="tok-123" coupleEventId="e1" onExitPortal={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('Jane').length).toBeGreaterThan(0));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /rsvp now/i }));
    expect(screen.getByRole('button', { name: /update rsvp/i })).toBeInTheDocument();
  });

  it('shows the sign-in gate when the token matches no guest', () => {
    vi.mocked(coupleGuestService.getCoupleGuests).mockReturnValue([]);
    render(<GuestPortal guestToken="unknown" coupleEventId="e1" onExitPortal={() => {}} />);
    // Historical compatibility still rejects a token that identifies no guest.
    expect(screen.getByPlaceholderText(/jane@example.com or Jane Smith/i)).toBeTruthy();
  });
});

describe('GuestPortal preview mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Smith & Johnson',
      eventStartDate: '2026-06-06',
      showMap: true,
      showSchedule: true,
      showWayfinding: true,
      showRSVP: true,
      showLodging: false,
    } as any);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(true);
    vi.mocked(coupleGuestService.getCoupleGuests).mockReturnValue([
      { id: 'g1', name: 'Jane', token: 'tok-123', eventName: 'e1' },
    ] as any);
  });

  it('bypasses the sign-in gate and shows the preview banner', async () => {
    render(<GuestPortal coupleEventId="e1" preview onExitPortal={() => {}} />);
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/jane@example.com or Jane Smith/i)).toBeNull();
    });
    expect(screen.getByText(/Preview mode/i)).toBeTruthy();
  });

  it('does not create a guest session in preview', async () => {
    render(<GuestPortal coupleEventId="e1" preview onExitPortal={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Preview mode/i)).toBeTruthy();
    });
    expect(guestPortalHelpers.saveGuestPortalSession).not.toHaveBeenCalled();
  });

  it('scopes wayfinding to guest-visible event spaces and never invents a route', async () => {
    vi.mocked(coupleGuestService.getCouplePortalConfig).mockReturnValue({
      eventTitle: 'Smith & Johnson',
      eventStartDate: '2026-06-06',
      showMap: true,
      showSchedule: false,
      showWayfinding: true,
      showRSVP: false,
      showLodging: false,
    } as any);
    vi.mocked(wayfindingService.getVenueMapConfig).mockReturnValue({
      width: 100,
      height: 80,
      points: [
        { id: 'gate', label: 'Main Gate', kind: 'entry', x: 5, y: 5 },
        { id: 'ceremony', label: 'Ceremony Garden', description: 'Enter beside the fountain.', kind: 'space', x: 40, y: 20, venueId: 'ceremony' },
        { id: 'reception', label: 'Reception Hall', kind: 'space', x: 70, y: 30, venueId: 'reception' },
        { id: 'service', label: 'Service Yard', kind: 'amenity', x: 80, y: 70, audience: 'staff' },
      ],
      routes: [{
        id: 'guest-route',
        name: 'Garden Walk',
        pointIds: ['gate', 'ceremony'],
        audience: 'public',
        accessibility: 'unknown',
        notes: 'Stay on the signed path.',
      }],
      rainContingencies: [],
      drawings: [],
      updatedAt: new Date().toISOString(),
    });

    render(<GuestPortal coupleEventId="e1" preview onExitPortal={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Preview mode/i)).toBeTruthy());
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /Getting Around/i }));

    expect(screen.getAllByText(/Ceremony Garden/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Reception Hall/)).toBeNull();
    expect(screen.queryByText(/Service Yard/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Ceremony Garden/ })).toBeNull();

    await user.selectOptions(screen.getByLabelText('Directions destination'), 'ceremony');
    await user.click(screen.getByRole('button', { name: 'Get Directions' }));
    expect(screen.getByText(/Follow “Garden Walk”/)).toBeInTheDocument();
    expect(screen.getByText('Stay on the signed path.')).toBeInTheDocument();
    expect(screen.getByText('Enter beside the fountain.')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Use verified step-free routes only/i }));
    await user.click(screen.getByRole('button', { name: 'Get Directions' }));
    expect(screen.getByText(/No verified step-free route is published/)).toBeInTheDocument();
  });
});
