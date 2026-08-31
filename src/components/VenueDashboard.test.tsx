import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emit } from '../utils/appEvents';

vi.mock('../config', () => ({
  getConfig: () => ({ venueName: 'Seven Paths Manor', primaryColor: '#4A1942', textColor: '#1f2937', backgroundColor: '#f3f4f6' }),
  useBrandingConfig: () => ({ venueName: 'Seven Paths Manor', primaryColor: '#4A1942', textColor: '#1f2937', backgroundColor: '#f3f4f6' }),
}));
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
    user: {
      id: 'u1',
      name: 'Admin',
      username: 'admin',
      email: 'admin@example.com',
      password: '',
      role: 'admin',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    } satisfies import('../types').User,
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

  it('does not render an overlay hamburger Menu over the landing sidebar', () => {
    render(<VenueDashboard {...baseProps} />);
    expect(screen.queryByRole('button', { name: /toggle navigation menu/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/close navigation menu/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument();
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

  it('switches to vendors section and returns to home section when spm_dashboard_go_home is dispatched', () => {
    render(
      <VenueDashboard
        {...baseProps}
        vendorsNode={<div data-testid="test-vendors-panel">Vendors Content</div>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /vendor showcase/i }));
    expect(screen.getByTestId('test-vendors-panel')).toBeInTheDocument();

    // Trigger return to home (as happens when closing inline Vendors/Ops/Timeline)
    act(() => {
      emit('spm_dashboard_go_home');
    });
    expect(screen.queryByTestId('test-vendors-panel')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Welcome back/i).length).toBeGreaterThan(0);
  });

  it('switches to ops or timeline section when spm_dashboard_open_section is dispatched', () => {
    render(
      <VenueDashboard
        {...baseProps}
        opsNode={<div data-testid="test-ops-panel">Ops Content</div>}
        timelineNode={<div data-testid="test-timeline-panel">Timeline Content</div>}
      />,
    );

    act(() => {
      emit('spm_dashboard_open_section', 'ops');
    });
    expect(screen.getByTestId('test-ops-panel')).toBeInTheDocument();

    act(() => {
      emit('spm_dashboard_open_section', 'timeline');
    });
    expect(screen.getByTestId('test-timeline-panel')).toBeInTheDocument();
  });

  it('renders Unread Couple Messages alert banner and allows clicking KPI card to switch to chat section', async () => {
    const chatService = await import('../services/couples/coupleChatService');
    const spy = vi
      .spyOn(chatService, 'getUnreadCoupleMessageCounts')
      .mockReturnValue({ c1: 2 });

    render(<VenueDashboard {...baseProps} />);
    expect(
      screen.getByText(/2 Unread Messages from Couples/i),
    ).toBeInTheDocument();

    const unreadBtn = screen.getByRole('button', {
      name: /2 unread couple messages/i,
    });
    fireEvent.click(unreadBtn);
    expect(
      screen.getByRole('heading', { name: /portal chat & direct messages/i }),
    ).toBeInTheDocument();

    spy.mockRestore();
  });

  it('applies brand primary color to Sign Out link, Quick actions buttons, and Upcoming events chips', () => {
    render(<VenueDashboard {...baseProps} />);

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    expect(signOutBtn.style.color).toBe('rgb(74, 25, 66)');

    const studioQuickBtns = screen.getAllByRole('button', { name: /design studio/i });
    expect(studioQuickBtns[1].style.color).toBe('rgb(74, 25, 66)');
  });
});
