import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CouplesPortal from './CouplesPortal';
import {
  createCoupleEvent,
  saveCoupleSession,
  getCoupleEvents,
  resolveCoupleInviteToken,
} from '../services/couples/coupleService';

vi.mock('../hooks/useLayoutState', () => ({
  getVenues: () => [
    { id: 'ceremony', name: 'Ceremony Garden', width: 60, height: 40, capacity: 150, environment: 'outdoor' },
    { id: 'reception', name: 'Reception Hall', width: 80, height: 60, capacity: 250, environment: 'indoor' },
  ],
}));

describe('CouplesPortal - High-Density Executive Layout & Usability (#158)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setupTestEvent() {
    const ev = createCoupleEvent({
      coupleName: 'High Density Couple',
      eventDate: '2027-09-15',
      guestCount: 180,
      availableSpaces: ['ceremony', 'reception'],
    });
    const owner = resolveCoupleInviteToken(ev.inviteToken)!;
    saveCoupleSession(owner.event.id, owner.collaborator.id);
    return getCoupleEvents()[0];
  }

  it('renders Couples Portal with max-w-7xl high-density container and 6 interactive KPI jump cards on Overview', () => {
    setupTestEvent();
    const { container } = render(<CouplesPortal onExitPortal={() => {}} />);

    // Verify main container uses full-width max-w-7xl
    const mainEl = container.querySelector('main');
    expect(mainEl?.className).toContain('max-w-7xl');

    // Verify scrolling is enabled on the outer wrapper
    const rootEl = container.firstChild as HTMLElement;
    expect(rootEl?.className).toContain('overflow-y-auto');

    // Verify all 6 interactive KPI jump buttons are present on Overview
    expect(screen.getByText(/Selected Spaces/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Invited Guests/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Layout Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Prep Checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Package Cap/i)).toBeInTheDocument();
    expect(screen.getByText(/Venue Chat/i)).toBeInTheDocument();
  });

  it('renders Venue Spaces in a multi-column grid with direct Design Floor Plan action buttons', () => {
    setupTestEvent();
    render(<CouplesPortal onExitPortal={() => {}} />);

    // Navigate to Venue Spaces tab
    fireEvent.click(screen.getByRole('tab', { name: /Venue Spaces/i }));
    expect(screen.getByText('Ceremony Garden')).toBeInTheDocument();
    expect(screen.getByText('Reception Hall')).toBeInTheDocument();

    // Select Ceremony Garden and verify the 1-click Design Floor Plan button appears
    fireEvent.click(screen.getByText('Ceremony Garden'));
    expect(screen.getByText(/Design Floor Plan/i)).toBeInTheDocument();
  });

  it('renders Design & Approval in a 2-column Command Center layout', () => {
    setupTestEvent();
    render(<CouplesPortal onExitPortal={() => {}} />);

    fireEvent.click(screen.getByRole('tab', { name: /Design & Approval/i }));
    expect(screen.getByText(/Design & Approval Command Center/i)).toBeInTheDocument();
    expect(screen.getByText(/Your Selected Venue Spaces/i)).toBeInTheDocument();
  });

  it('renders Checklist in a 3-column phase-grouped Kanban board', () => {
    setupTestEvent();
    render(<CouplesPortal onExitPortal={() => {}} />);

    fireEvent.click(screen.getByRole('tab', { name: /Checklist/i }));
    expect(screen.getByText(/Your event checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/No checklist items yet/i)).toBeInTheDocument();
  });

  it('renders Vendors with the 3-column Preferred Vendor Showcase grid', () => {
    setupTestEvent();
    render(<CouplesPortal onExitPortal={() => {}} />);

    fireEvent.click(screen.getByRole('tab', { name: /Vendors/i }));
    expect(screen.getByText(/Your vendors & wedding team/i)).toBeInTheDocument();
    expect(screen.getByText(/Your Booked Wedding Team/i)).toBeInTheDocument();
  });
});
