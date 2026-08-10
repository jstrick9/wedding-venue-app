import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import CouplesPortal from './CouplesPortal';
import {
  createCoupleEvent,
  saveCoupleSession,
  loadCoupleSession,
  getCoupleEvents,
  clearCoupleSession,
} from '../services/couples/coupleService';

describe('CouplesPortal - test wedding event access & quick switch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('overrides an existing stored session when opening a newly created test wedding event via token', () => {
    // 1. Create an old couple event and save its session in localStorage
    const oldEvent = createCoupleEvent({
      coupleName: 'Old Existing Couple',
      eventDate: '2025-01-01',
    });
    saveCoupleSession(oldEvent.id, `col-${oldEvent.id}-owner`);
    expect(loadCoupleSession()?.eventId).toBe(oldEvent.id);

    // 2. Create a new test wedding event
    const newTestEvent = createCoupleEvent({
      coupleName: 'Alice & Bob Test Wedding',
      eventDate: '2026-10-10',
    });

    // 3. Render CouplesPortal with the new test event token
    render(
      <CouplesPortal
        coupleToken={newTestEvent.inviteToken}
        onExitPortal={() => {}}
      />
    );

    // 4. Verify that the portal displays the newly created test wedding event
    expect(screen.getAllByText('Alice & Bob Test Wedding').length).toBeGreaterThan(0);
    expect(loadCoupleSession()?.eventId).toBe(newTestEvent.id);
  });

  it('allows selecting a created test wedding event from the Quick-Select dropdown when no session is active', () => {
    clearCoupleSession();
    const testEvent = createCoupleEvent({
      coupleName: 'Quick Select Test Wedding',
      eventDate: '2027-05-15',
    });

    render(<CouplesPortal onExitPortal={() => {}} />);

    // Check that we see the Quick-Select dropdown
    expect(screen.getByText(/Quick-Select Booked Couple \(Test Mode\)/i)).toBeInTheDocument();

    const select = screen.getByRole('combobox', { name: /Quick select couple event/i });
    fireEvent.change(select, { target: { value: testEvent.inviteToken } });

    const launchBtn = screen.getByRole('button', { name: /Launch ↗/i });
    fireEvent.click(launchBtn);

    // Verify it launched into the test wedding event
    expect(screen.getAllByText('Quick Select Test Wedding').length).toBeGreaterThan(0);
  });
});
