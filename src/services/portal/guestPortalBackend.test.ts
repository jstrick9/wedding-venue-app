import { beforeEach, describe, expect, it, vi } from 'vitest';

// Force local provider for the local-backend tests.
vi.mock('../platform', () => ({
  getPlatformProvider: () => 'local',
}));

let portalGuests: any[] = [];
let rsvpSubs: any[] = [];

vi.mock('../../utils/guestPortal', () => ({
  getPortalGuestsForEvent: () => portalGuests,
  findGuestInEvent: (_event: string, identifier: string) =>
    portalGuests.find((g) =>
      g.email === identifier || g.name === identifier || g.token === identifier,
    ),
  getPortalRSVPSubmissions: () => rsvpSubs,
  setPortalRSVPSubmissions: (s: any[]) => { rsvpSubs = s; },
}));

import { LocalGuestPortalBackend, getGuestPortalBackend } from './guestPortalBackend';

describe('guestPortalBackend (local)', () => {
  beforeEach(() => {
    portalGuests = [];
    rsvpSubs = [];
  });

  it('getGuestPortalBackend returns the local provider', () => {
    expect(getGuestPortalBackend().provider).toBe('local');
  });

  it('findGuest resolves by email/name/token', async () => {
    portalGuests = [{ id: 'g1', name: 'Jane', email: 'jane@x.com', token: 'tok123' }];
    const backend = new LocalGuestPortalBackend();
    expect((await backend.findGuest({ eventName: 'Wed' }, 'jane@x.com'))?.id).toBe('g1');
    expect((await backend.findGuest({ eventName: 'Wed' }, 'Jane'))?.id).toBe('g1');
  });

  it('submitRSVP upserts by guest and persists', async () => {
    const backend = new LocalGuestPortalBackend();
    const sub: any = {
      id: 'r1', guestId: 'g1', fullName: 'Jane', email: 'jane@x.com', attending: true, submittedAt: 'now',
    };
    await backend.submitRSVP({ eventName: 'Wed' }, sub);
    expect(rsvpSubs).toHaveLength(1);
    // Resubmit same guest -> replace, not duplicate.
    await backend.submitRSVP({ eventName: 'Wed' }, { ...sub, mealChoice: 'veg' });
    expect(rsvpSubs).toHaveLength(1);
    expect(rsvpSubs[0].mealChoice).toBe('veg');
  });
});
