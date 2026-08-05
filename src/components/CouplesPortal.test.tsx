import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CouplesPortal from './CouplesPortal';
import {
  createCoupleEvent,
  saveCoupleSession,
  getCoupleEvents,
  resolveCoupleInviteToken,
  addCoupleCollaborator,
} from '../services/couples/coupleService';
import type { CoupleCollaboratorRole } from '../types';

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

  it('renders the checklist and vendors tabs', () => {
    setupSession('Check & Co');
    render(<CouplesPortal onExitPortal={() => {}} />);
    expect(screen.getByText('Checklist')).toBeTruthy();
    expect(screen.getByText('Vendors')).toBeTruthy();
    fireEvent.click(screen.getByText('Checklist'));
    expect(screen.getByText(/Your event checklist/i)).toBeTruthy();
    fireEvent.click(screen.getByText('Vendors'));
    expect(screen.getByText(/Your vendors/i)).toBeTruthy();
  });

  function setupRoleSession(role: CoupleCollaboratorRole) {
    const ev = createCoupleEvent({ coupleName: 'Role & Test', availableSpaces: ['ceremony', 'reception'] });
    const collaborator = addCoupleCollaborator(ev.id, {
      name: 'Helper',
      email: 'helper@example.com',
      role,
    })!;
    saveCoupleSession(ev.id, collaborator.id);
    return getCoupleEvents()[0];
  }

  it('restricts a vendor to view-only (no space/guest/portal edits)', () => {
    setupRoleSession('vendor');
    render(<CouplesPortal onExitPortal={() => {}} />);

    fireEvent.click(screen.getByText('Venue Spaces'));
    expect(screen.getByText(/View-only — your role cannot change the selected spaces/i)).toBeTruthy();

    fireEvent.click(screen.getByText('Guests'));
    expect(screen.getByText(/View-only — your role cannot add, edit, or remove guests/i)).toBeTruthy();

    fireEvent.click(screen.getByText('Portal Settings'));
    expect(screen.getByText(/View-only — only the couple can change portal settings/i)).toBeTruthy();
  });

  it('lets a vendor chat but not edit portal settings', () => {
    setupRoleSession('vendor');
    render(<CouplesPortal onExitPortal={() => {}} />);
    fireEvent.click(screen.getByText('Portal Settings'));
    // Read-only summary shown, no save button.
    expect(screen.queryByText('💾 Save portal settings')).toBeNull();
  });

  it('lets a planner manage guests but not portal settings', () => {
    setupRoleSession('planner');
    render(<CouplesPortal onExitPortal={() => {}} />);

    fireEvent.click(screen.getByText('Guests'));
    expect(screen.queryByText(/View-only — your role cannot add, edit, or remove guests/i)).toBeNull();
    // Add-guest form present for a planner.
    expect(screen.getByPlaceholderText('Guest name')).toBeTruthy();

    fireEvent.click(screen.getByText('Portal Settings'));
    expect(screen.getByText(/View-only — only the couple can change portal settings/i)).toBeTruthy();
  });

  it('lets the couple edit portal settings (save button present)', () => {
    setupSession('Owner & Couple');
    render(<CouplesPortal onExitPortal={() => {}} />);
    fireEvent.click(screen.getByText('Portal Settings'));
    expect(screen.getByText('💾 Save portal settings')).toBeTruthy();
  });
});
