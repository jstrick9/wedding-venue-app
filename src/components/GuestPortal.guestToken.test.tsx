import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/guestPortal', () => ({
  clearGuestPortalSession: vi.fn(),
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

describe('GuestPortal guest-token auto-auth', () => {
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

  it('auto-authenticates a guest via their invite token (no sign-in gate)', async () => {
    render(<GuestPortal guestToken="tok-123" coupleEventId="e1" onExitPortal={() => {}} />);

    // After the mount effect runs, the gate should be bypassed (guest identifier input gone).
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('jane@example.com or Jane Smith')).toBeNull();
    });
    // And the guest token triggered a session save.
    await waitFor(() => {
      expect(guestPortalHelpers.saveGuestPortalSession).toHaveBeenCalled();
    });
  });

  it('shows the sign-in gate when the token matches no guest', () => {
    vi.mocked(coupleGuestService.getCoupleGuests).mockReturnValue([]);
    render(<GuestPortal guestToken="unknown" coupleEventId="e1" onExitPortal={() => {}} />);
    // Should fall through to the gate (not auto-auth).
    expect(screen.getByPlaceholderText(/jane@example.com or Jane Smith/i)).toBeTruthy();
  });
});
