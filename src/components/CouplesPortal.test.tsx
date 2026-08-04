import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CouplesPortal from './CouplesPortal';
import { createCoupleEvent, saveCoupleSession, getCoupleEvents, resolveCoupleInviteToken } from '../services/couples/coupleService';

vi.mock('../hooks/useLayoutState', () => ({
  getVenues: () => [
    { id: 'ceremony', name: 'Ceremony Garden', width: 60, height: 40, capacity: 100 },
    { id: 'reception', name: 'Reception Hall', width: 80, height: 60, capacity: 200 },
  ],
}));

describe('CouplesPortal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setupSession(coupleName: string, extra: Partial<Parameters<typeof createCoupleEvent>[0]> = {}) {
    const ev = createCoupleEvent({ coupleName, ...extra });
    // Resolving the invite token creates the implicit owner collaborator.
    const owner = resolveCoupleInviteToken(ev.inviteToken)!;
    saveCoupleSession(owner.event.id, owner.collaborator.id);
    return getCoupleEvents()[0];
  }

  it('renders the couple overview from a saved session', () => {
    setupSession('Smith & Johnson', { eventDate: '2026-06-06', guestCount: 120 });
    render(<CouplesPortal onExitPortal={() => {}} />);
    expect(screen.getAllByText('Smith & Johnson').length).toBeGreaterThan(0);
    expect(screen.getByText('👥 120 guests')).toBeTruthy();
  });

  it('lets a couple select venue spaces', () => {
    setupSession('A & B', { availableSpaces: ['ceremony', 'reception'] });
    render(<CouplesPortal onExitPortal={() => {}} />);
    fireEvent.click(screen.getByText('Venue Spaces'));

    expect(screen.getByText('Ceremony Garden')).toBeTruthy();
    fireEvent.click(screen.getByText('Ceremony Garden'));
    const updated = getCoupleEvents()[0];
    expect(updated.selectedSpaces).toContain('ceremony');
  });

  it('shows invalid invite state for a bad token', () => {
    render(<CouplesPortal coupleToken="bad-token" onExitPortal={() => {}} />);
    expect(screen.getByText('Invitation not found')).toBeTruthy();
  });
});
