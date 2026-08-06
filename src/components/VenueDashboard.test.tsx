import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../config', () => ({ getConfig: () => ({ venueName: 'Seven Paths Manor', primaryColor: '#4A1942', textColor: '#1f2937', backgroundColor: '#f3f4f6' }) }));
vi.mock('../hooks/useLayoutState', () => ({ getVenues: () => [{ id: 'reception', name: 'Reception Hall', category: 'reception' }] }));
vi.mock('../services/couples/coupleService', () => ({
  getCoupleEvents: vi.fn(() => [
    { id: 'c1', coupleName: 'Smith & Jones', eventDate: '2099-01-01', status: 'active', inviteToken: 'tok1', layoutStatus: 'pending', selectedSpaces: [], availableSpaces: [], collaborators: [] },
  ]),
}));
vi.mock('../services/couples/coupleGuestService', () => ({ getCoupleGuests: () => [] }));
vi.mock('../services/couples/coupleRsvpService', () => ({ getCoupleRsvpSubmissions: () => [] }));
vi.mock('../services/couples/coupleSetupService', () => ({ getCoupleSetupTasks: () => [] }));
vi.mock('../services/couples/coupleGuestEventService', () => ({ getCoupleGuestEvents: () => [], getAssignedGuestCount: () => 0 }));
vi.mock('../services/couples/couplePackageService', () => ({ findWeddingPackage: () => undefined }));
vi.mock('../services/calendar/venueCalendarService', () => ({
  getVenueCalendarEvents: () => [],
  getVenueCalendarEventsInRange: () => [],
  addVenueCalendarEvent: () => null,
  updateVenueCalendarEvent: () => {},
  removeVenueCalendarEvent: () => {},
  CALENDAR_CATEGORY_LABELS: { couple: 'Couple Event', 'open-house': 'Open House', staffing: 'Staffing / Work', other: 'Other Event' },
}));

import { VenueDashboard } from './VenueDashboard';
import * as coupleService from '../services/couples/coupleService';

describe('VenueDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseProps = {
    user: { id: 'u1', name: 'Admin', username: 'admin' },
    isAdmin: true,
    isStaff: true,
    canAdmin: true,
    canOps: true,
    onOpenAdmin: vi.fn(),
    onOpenOperations: vi.fn(),
    onOpenVendors: vi.fn(),
    onOpenTimeline: vi.fn(),
    onOpenStudio: vi.fn(),
    onLogout: vi.fn(),
  };

  it('renders the home widgets and persistent sidebar', () => {
    render(<VenueDashboard {...baseProps} />);
    expect(screen.getAllByText(/Welcome back/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Active couples/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Awaiting layout review/i).length).toBeGreaterThan(0);
    // Sidebar nav items.
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getAllByText('Design Studio').length).toBeGreaterThan(0);
  });

  it('switches to the calendar section', async () => {
    const user = userEvent.setup();
    render(<VenueDashboard {...baseProps} />);
    await user.click(screen.getAllByRole('button', { name: /Calendar/i })[0]);
    // Calendar view toggles appear.
    expect(screen.getByRole('button', { name: /^Month$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Agenda$/i })).toBeTruthy();
  });

  it('shows onboarding empty-state when there are no couples', () => {
    vi.mocked(coupleService.getCoupleEvents).mockReturnValue([]);
    render(<VenueDashboard {...baseProps} />);
    expect(screen.getAllByText(/Let's set up/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Create your first couple event/i)).toBeTruthy();
    expect(screen.getByText(/Schedule an open house/i)).toBeTruthy();
  });

  it('calls onOpenStudio for the Design Studio action', async () => {
    const user = userEvent.setup();
    render(<VenueDashboard {...baseProps} />);
    await user.click(screen.getAllByRole('button', { name: /Design Studio/i })[0]);
    expect(baseProps.onOpenStudio).toHaveBeenCalled();
  });
});
