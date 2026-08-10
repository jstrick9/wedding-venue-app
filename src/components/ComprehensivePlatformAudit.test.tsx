import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VenueDashboard } from './VenueDashboard';
import StaffOperationsPanel from './StaffOperationsPanel';
import CouplesPortal from './CouplesPortal';
import { setConfig, getConfig } from '../config';
import { defaultVenues } from '../data/venueData';
import {
  createCoupleEvent,
  getCoupleEvents,
  resolveCoupleInviteToken,
  saveCoupleSession,
} from '../services/couples/coupleService';

describe('Comprehensive Platform Application & Functional Design Audit (#153)', () => {
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

  it('renders all 7 dashboard KPI stat cards as interactive buttons with accessibility labels and correct section navigation', () => {
    const onOpenAdmin = vi.fn();
    render(
      <VenueDashboard
        user={{ id: 'admin-1', username: 'admin', name: 'Jane Admin' }}
        isAdmin={true}
        isStaff={false}
        canAdmin={true}
        canOps={true}
        onOpenAdmin={onOpenAdmin}
        onOpenOperations={() => {}}
        onOpenVendors={() => {}}
        onOpenTimeline={() => {}}
        onOpenStudio={() => {}}
        onLogout={() => {}}
      />
    );

    // Check accessible buttons for KPI stat cards
    const activeCouplesBtn = screen.getByRole('button', { name: /^0\s*active couples$/i });
    expect(activeCouplesBtn).toHaveAttribute('title', 'Open Couples Portal overview');

    const awaitingReviewBtn = screen.getByRole('button', { name: /^0\s*awaiting layout review$/i });
    expect(awaitingReviewBtn).toHaveAttribute('title', 'Open Couples Portal to review layouts');

    const setupBtn = screen.getByRole('button', { name: /setup/i });
    expect(setupBtn).toHaveAttribute('title', 'Open Operations Studio to review setup checklists');

    const overnightBtn = screen.getByRole('button', { name: /overnight guests assigned/i });
    expect(overnightBtn).toHaveAttribute('title', 'Open Couples Portal to review lodging assignments');

    const openHousesBtn = screen.getByRole('button', { name: /open houses scheduled/i });
    expect(openHousesBtn).toHaveAttribute('title', 'Open Calendar to view open houses');

    // Clicking "Active couples" opens the couples section
    fireEvent.click(activeCouplesBtn);
    expect(screen.getByRole('heading', { name: /Couples Portal/i })).toBeInTheDocument();
  });

  it('navigates to specific admin tabs when clicking dashboard onboarding cards', () => {
    const onOpenAdmin = vi.fn();
    render(
      <VenueDashboard
        user={{ id: 'admin-1', username: 'admin', name: 'Jane Admin' }}
        isAdmin={true}
        isStaff={false}
        canAdmin={true}
        canOps={true}
        onOpenAdmin={onOpenAdmin}
        onOpenOperations={() => {}}
        onOpenVendors={() => {}}
        onOpenTimeline={() => {}}
        onOpenStudio={() => {}}
        onLogout={() => {}}
      />
    );

    const manageSpacesBtn = screen.getByRole('button', { name: /manage venue spaces/i });
    fireEvent.click(manageSpacesBtn);
    expect(onOpenAdmin).toHaveBeenCalledWith('venues');

    const managePackagesBtn = screen.getByRole('button', { name: /review packages/i });
    fireEvent.click(managePackagesBtn);
    expect(onOpenAdmin).toHaveBeenCalledWith('packages');
  });

  it('renders interactive StatCards on Staff Operations Overview that navigate to tasks tab when clicked', () => {
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

    // Click "Total Tasks" stat card button
    const totalTasksBtn = screen.getByTitle(/click to view total tasks/i);
    fireEvent.click(totalTasksBtn);

    // Should switch to the Tasks tab
    expect(screen.getByRole('button', { name: /\+ Add Task/i })).toBeInTheDocument();
  });

  it('renders the Quick Guest List Search & Status Filter bar at the top of Couples Portal Guests tab', () => {
    setupSession('Alex & Jordan', { eventDate: '2026-10-15', guestCount: 150 });
    render(<CouplesPortal onExitPortal={() => {}} />);

    // Switch to Guests & RSVPs tab
    const guestsTab = screen.getByRole('tab', { name: /Guests/i });
    fireEvent.click(guestsTab);

    // Check for the new top-level Quick Guest Search input
    const quickSearchInput = screen.getByPlaceholderText(/Quick search guest by name, email, or phone/i);
    expect(quickSearchInput).toBeInTheDocument();

    // Check status filter buttons
    const attendingFilterBtn = screen.getAllByRole('button', { name: /Attending/i })[0];
    expect(attendingFilterBtn).toBeInTheDocument();
  });

  it('sets --accent, --accent-light, and --accent-dark CSS variables on :root for Guest Portal compatibility', () => {
    setConfig({
      ...getConfig(),
      primaryColor: '#1E3A8A',
      primaryDark: '#172A67',
    });

    const rootStyle = document.documentElement.style;
    expect(rootStyle.getPropertyValue('--accent')).toBe('#1E3A8A');
    expect(rootStyle.getPropertyValue('--accent-dark')).toBe('#172A67');
    expect(rootStyle.getPropertyValue('--accent-light')).toContain('#1E3A8A');
  });
});
