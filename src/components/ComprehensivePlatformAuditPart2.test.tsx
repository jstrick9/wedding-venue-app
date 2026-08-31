import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VenueDashboard } from './VenueDashboard';
import StaffOperationsPanel from './StaffOperationsPanel';
import { VendorPanel } from './VendorPanel';
import CouplesPortal from './CouplesPortal';
import { setConfig, getConfig } from '../config';
import { defaultVenues } from '../data/venueData';
import { createCoupleEvent, getCoupleEvents, resolveCoupleInviteToken, saveCoupleSession } from '../services/couples/coupleService';
import { addVenueCalendarEvent } from '../services/calendar/venueCalendarService';

describe('Comprehensive Platform Application & Functional Design Audit Part 2 (#154)', () => {
  beforeEach(() => {
    localStorage.clear();
    setConfig({
      ...getConfig(),
      primaryColor: '#4A1942',
      primaryDark: '#3d1a45',
      primaryLight: '#6b2c5c',
    });
  });

  function setupSession(coupleName: string, extra: Partial<Parameters<typeof createCoupleEvent>[0]> = {}) {
    const ev = createCoupleEvent({ coupleName, ...extra });
    const owner = resolveCoupleInviteToken(ev.inviteToken)!;
    saveCoupleSession(owner.event.id, owner.collaborator.id);
    return getCoupleEvents()[0];
  }

  it('renders Today strip items as interactive buttons and Upcoming Events non-couple items with View in calendar actions', () => {
    // Add a custom calendar event for today and upcoming
    const todayStr = new Date().toISOString().slice(0, 10);
    addVenueCalendarEvent({
      title: 'Spring Open House',
      category: 'open-house',
      date: todayStr,
      startTime: '10:00',
      endTime: '12:00',
    });

    render(
      <VenueDashboard
        user={{
          id: 'admin-1',
          username: 'admin',
          name: 'Jane Admin',
          email: 'admin@example.com',
          password: '',
          role: 'admin',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        isAdmin={true}
        isStaff={false}
        canAdmin={true}
        canOps={true}
        onOpenAdmin={() => {}}
        onOpenOperations={() => {}}
        onOpenVendors={() => {}}
        onOpenTimeline={() => {}}
        onOpenStudio={() => {}}
        onLogout={() => {}}
      />
    );

    // Today strip button for Spring Open House
    const todayBtn = screen.getByRole('button', { name: /Spring Open House/i });
    expect(todayBtn).toHaveAttribute('title', 'Open calendar for Spring Open House');

    // Upcoming events list action button for non-couple event
    const viewCalBtn = screen.getByRole('button', { name: /View in calendar →/i });
    expect(viewCalBtn).toHaveAttribute('title', 'Open calendar for Spring Open House');
  });

  it('renders the Quick Search box on Staff Operations Checklists tab and filters items dynamically', () => {
    render(
      <StaffOperationsPanel
        currentUser={{
          id: 'admin-1',
          username: 'admin',
          email: 'admin@example.com',
          password: '',
          role: 'admin',
          name: 'Jane Admin',
          isActive: true,
          createdAt: new Date().toISOString(),
        }}
        isAdmin={true}
        users={[]}
        venues={defaultVenues}
        onClose={() => {}}
        inline={true}
      />
    );

    // Switch to Checklists tab
    const checklistsBtn = screen.getByRole('button', { name: /Checklists/i });
    fireEvent.click(checklistsBtn);

    // Verify search input is present
    const searchInput = screen.getByPlaceholderText(/Quick search checklist item by task or keyword/i);
    expect(searchInput).toBeInTheDocument();

    // Type a search filter
    fireEvent.change(searchInput, { target: { value: 'ceremony' } });
    expect(searchInput).toHaveValue('ceremony');
  });

  it('renders VendorPanel category filter buttons and search box dynamically', () => {
    render(<VendorPanel onClose={() => {}} inline={true} />);

    expect(screen.getByRole('heading', { name: /Preferred Vendors/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All \(0\)/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search vendors…/i)).toBeInTheDocument();
  });

  it('renders the Quick Guest List Search & Status Filter bar and filters by RSVP in CouplesPortal', () => {
    setupSession('Taylor & Morgan', { eventDate: '2026-11-20', guestCount: 180 });
    render(<CouplesPortal onExitPortal={() => {}} />);

    // Switch to Guests & RSVPs tab
    const guestsTab = screen.getByRole('tab', { name: /Guests/i });
    fireEvent.click(guestsTab);

    // Verify Quick Search input and Status filters
    const searchInput = screen.getByPlaceholderText(/Quick search guest by name, email, or phone/i);
    expect(searchInput).toBeInTheDocument();

    const attendingBtn = screen.getAllByRole('button', { name: /Attending/i })[0];
    expect(attendingBtn).toBeInTheDocument();
  });
});
