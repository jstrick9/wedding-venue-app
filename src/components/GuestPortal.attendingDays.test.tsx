import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/guestPortal', () => {
  return {
    celebrationStatusDays: (startDate: unknown, endDate: unknown, isMultiDay: boolean) => {
      if (!startDate) return null;
      const now = Date.now();
      const start = new Date(startDate as string).getTime();
      const end = isMultiDay && endDate ? new Date(endDate as string).getTime() : start;
      if (!Number.isNaN(end) && now > end) return -1;
      if (now >= start) return 0;
      return Math.ceil((start - now) / 86400000);
    },
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

vi.mock('../utils/auth', () => ({ verifySecret: vi.fn() }));

import GuestPortal from './GuestPortal';
import * as guestPortalHelpers from '../utils/guestPortal';

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

describe('GuestPortal multi-day attending-days', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(true);
  });

  it('renders one attending-day checkbox per event day (multi-day)', async () => {
    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      eventEndDate: '2026-05-14',
      isMultiDay: true,
      showRSVP: true,
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showLodging: false,
    } as any);

    const user = userEvent.setup();
    renderAuthed();
    await user.click(screen.getByRole('button', { name: /rsvp now/i }));

    expect(screen.getByText('Which days will you attend?')).toBeTruthy();
    // 3-day event => 3 attending-day checkboxes
    const dayCheckboxes = screen.getAllByRole('checkbox', { name: /^Day \d/ });
    expect(dayCheckboxes).toHaveLength(3);
  });

  it('hides the attending-days section for single-day events', async () => {
    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      eventEndDate: '2026-05-12',
      isMultiDay: false,
      showRSVP: true,
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showLodging: false,
    } as any);

    const user = userEvent.setup();
    renderAuthed();
    await user.click(screen.getByRole('button', { name: /rsvp now/i }));

    expect(screen.queryByText('Which days will you attend?')).toBeNull();
  });
});
