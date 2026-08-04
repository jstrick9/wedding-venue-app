import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    isGuestPortalEventActive: vi.fn(() => true),
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
import { DEFAULT_MEAL_OPTIONS } from '../types';

function renderAuthed() {
  vi.mocked(guestPortalHelpers.loadGuestPortalSession).mockReturnValue({
    v: 1,
    guestId: 'g1',
    eventKey: 'spring-wedding',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    portalFingerprint: 'test',
  } as any);
  vi.mocked(guestPortalHelpers.getPortalGuestsForEvent).mockReturnValue([
    { id: 'g1', name: 'Jane Guest', email: 'jane@example.com', eventName: 'Spring Wedding', allowPortalAccess: true },
  ] as any);
  return render(<GuestPortal onExitPortal={() => undefined} />);
}

describe('GuestPortal configurable meal options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: true,
      showLodging: false,
    } as any);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(true);
  });

  it('renders the default meal options when none are configured', async () => {
    const user = userEvent.setup();
    renderAuthed();
    await user.click(screen.getByRole('button', { name: /rsvp now/i }));

    const select = screen.getByLabelText('Meal choice') as HTMLSelectElement;
    expect(select).toBeTruthy();
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toContain('Chicken');
    expect(labels).toContain('Vegetarian');
    // matches DEFAULT_MEAL_OPTIONS count
    expect(select.options.length).toBe(DEFAULT_MEAL_OPTIONS.length);
  });

  it('renders the venue-configured meal options instead of defaults', async () => {
    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      showRSVP: true,
      mealOptions: [
        { value: 'filet', label: 'Filet Mignon' },
        { value: 'salmon', label: 'Grilled Salmon' },
        { value: 'pasta', label: 'Pasta Primavera' },
      ],
    } as any);

    const user = userEvent.setup();
    renderAuthed();
    await user.click(screen.getByRole('button', { name: /rsvp now/i }));

    const select = screen.getByLabelText('Meal choice') as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toContain('Filet Mignon');
    expect(labels).toContain('Grilled Salmon');
    expect(labels).toContain('Pasta Primavera');
    expect(labels).not.toContain('Chicken');
  });
});
