import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/guestPortal', () => {
  return {
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
    isGuestPortalEventActive: vi.fn(),
    normalizeEventKey: (value: string) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
  };
});

vi.mock('../utils/auth', () => ({
  verifySecret: vi.fn(),
}));

import GuestPortal from './GuestPortal';
import * as guestPortalHelpers from '../utils/guestPortal';

describe('GuestPortal event expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows event unavailable when portal access has expired', () => {
    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      eventEndDate: '2026-05-13',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: false,
      showLodging: false,
    } as any);

    vi.mocked(guestPortalHelpers.getPortalVenues).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalGuests).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissions).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(false);

    render(<GuestPortal onExitPortal={() => undefined} />);

    expect(
      screen.getByText(/this guest portal is no longer available/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/guest access automatically ends the day after the event/i),
    ).toBeInTheDocument();
  });

  it('does not show the sign-in gate when the event is expired', () => {
    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      eventEndDate: '2026-05-13',
      portalPassword: 'secret123',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: false,
      showLodging: false,
    } as any);

    vi.mocked(guestPortalHelpers.getPortalVenues).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalGuests).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissions).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(false);

    render(<GuestPortal onExitPortal={() => undefined} />);

    expect(
      screen.queryByLabelText(/event name or code/i),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByLabelText(/guest email or name/i),
    ).not.toBeInTheDocument();
  });

  it('clears any existing guest portal session when the event is expired', () => {
    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      eventEndDate: '2026-05-13',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: false,
      showLodging: false,
    } as any);

    vi.mocked(guestPortalHelpers.getPortalVenues).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalGuests).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissions).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(false);

    render(<GuestPortal onExitPortal={() => undefined} />);

    expect(guestPortalHelpers.clearGuestPortalSession).toHaveBeenCalled();
  });
});