import { beforeEach, describe, expect, it } from 'vitest';
import { setPortalGuests, getPortalGuestsForEvent, findGuestInEvent, celebrationStatusDays, isGuestPortalEventActive, getGuestPortalAccessEnd } from './guestPortal';
import { guestCanAccessPortal, guestCanAccessLodging, guestCanSubmitRSVP, guestCanViewMap } from './guestAccess';
import { GuestPortalGuestRecord, GuestPortalConfig } from '../types';

const cfg = (overrides: Partial<GuestPortalConfig> = {}): GuestPortalConfig => ({
  eventTitle: 'Smith-Johnson Wedding',
  eventStartDate: '2026-09-12',
  eventEndDate: '2026-09-13',
  isMultiDay: true,
  showRSVP: true, showSchedule: true, showMap: true, showWayfinding: true, showLodging: true,
  accessGracePeriodHours: 36,
  ...overrides,
});

function guest(overrides: Partial<GuestPortalGuestRecord> = {}): GuestPortalGuestRecord {
  return {
    id: 'g1', name: 'Jane Smith', email: 'jane@example.com', token: 'g-token-1',
    eventName: 'smith-johnson-wedding', eventKey: 'smith-johnson-wedding',
    allowPortalAccess: true, allowLodgingAccess: true,
    ...overrides,
  };
}

/**
 * Guest persona: the guest portal journey — sign-in lookup, access gating,
 * celebration countdown, and the access/grace window.
 */
describe('guest persona journey', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('looks up a guest by email, name, or token', () => {
    setPortalGuests([guest()]);
    expect(findGuestInEvent('Smith-Johnson Wedding', 'jane@example.com')?.id).toBe('g1');
    expect(findGuestInEvent('Smith-Johnson Wedding', 'jane smith')?.id).toBe('g1');
    expect(findGuestInEvent('Smith-Johnson Wedding', 'g-token-1')?.id).toBe('g1');
    expect(findGuestInEvent('Smith-Johnson Wedding', 'nobody')).toBeUndefined();
  });

  it('gates access by portal/lodging/RSVP/map rules', () => {
    const c = cfg();
    const g = guest();
    expect(guestCanAccessPortal(g, 'Smith-Johnson Wedding')).toBe(true);
    expect(guestCanAccessLodging(g, 'Smith-Johnson Wedding')).toBe(true);
    expect(guestCanSubmitRSVP(g, 'Smith-Johnson Wedding')).toBe(true);
    expect(guestCanViewMap(g, 'Smith-Johnson Wedding')).toBe(true);
    // A guest without portal access is denied everything.
    const noAccess = guest({ allowPortalAccess: false });
    expect(guestCanAccessPortal(noAccess, 'Smith-Johnson Wedding')).toBe(false);
    expect(guestCanAccessLodging(noAccess, 'Smith-Johnson Wedding')).toBe(false);
    expect(guestCanSubmitRSVP(noAccess, 'Smith-Johnson Wedding')).toBe(false);
  });

  it('computes the celebration countdown for a multi-day event', () => {
    // 10 days before the 2026-09-12 start.
    const before = celebrationStatusDays('2026-09-12', '2026-09-13', true, new Date('2026-09-02T12:00:00'));
    expect(before).toBe(10);
    // During the event window -> 0 (big day).
    const during = celebrationStatusDays('2026-09-12', '2026-09-13', true, new Date('2026-09-12T12:00:00'));
    expect(during).toBe(0);
    // After the end day -> -1 (has passed).
    const after = celebrationStatusDays('2026-09-12', '2026-09-13', true, new Date('2026-09-14T12:00:00'));
    expect(after).toBe(-1);
  });

  it('keeps the portal active within the grace window after the event', () => {
    const c = cfg();
    // Grace = 36h after 2026-09-13T00:00 UTC. 2026-09-14 10:00 UTC is ~34h later -> active.
    expect(isGuestPortalEventActive(c, new Date('2026-09-14T10:00:00Z'))).toBe(true);
    // 2026-09-15 00:00 UTC is 48h later -> closed.
    expect(isGuestPortalEventActive(c, new Date('2026-09-15T00:00:00Z'))).toBe(false);
    // getGuestPortalAccessEnd is the moment it closes.
    expect(getGuestPortalAccessEnd(c)!.getTime()).toBeGreaterThan(new Date('2026-09-13T00:00:00Z').getTime());
  });
});
