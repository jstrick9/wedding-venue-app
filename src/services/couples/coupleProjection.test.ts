import { beforeEach, describe, expect, it } from 'vitest';
import { createCoupleEvent } from './coupleService';
import { addCoupleGuest } from './coupleGuestService';
import { upsertCoupleRsvp } from './coupleRsvpService';
import {
  buildCoupleProjectionPayload,
  mapCoupleStatusToEventStatus,
  orgDataArrayLength,
  slugifyCoupleId,
} from './coupleProjection';

describe('couple projection mapping', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('maps couple statuses onto relational event statuses', () => {
    expect(mapCoupleStatusToEventStatus('invited')).toBe('lead');
    expect(mapCoupleStatusToEventStatus('active')).toBe('planning');
    expect(mapCoupleStatusToEventStatus('completed')).toBe('completed');
  });

  it('builds a stable slug from a couple id', () => {
    expect(slugifyCoupleId('couple-AbC_123')).toBe('ce-couple-abc-123');
  });

  it('counts org_data payloads whether they are raw arrays or wrapped objects', () => {
    expect(orgDataArrayLength([{ id: 'a' }, { id: 'b' }])).toBe(2);
    expect(orgDataArrayLength({ coupleEvents: [{ id: 'a' }] }, 'coupleEvents')).toBe(1);
    expect(orgDataArrayLength(null)).toBe(0);
    expect(orgDataArrayLength({})).toBe(0);
  });

  it('projects couple events, guests, and RSVPs with source ids', () => {
    const event = createCoupleEvent({ coupleName: 'Ada & Alan', eventDate: '2027-06-12', guestCount: 80 });
    const guest = addCoupleGuest(event.id, { name: 'Grace Hopper', email: 'grace@example.com', plusOne: true });
    upsertCoupleRsvp(event.id, {
      id: 'rsvp-1',
      guestId: guest.id,
      fullName: 'Grace Hopper',
      email: 'grace@example.com',
      attending: true,
      mealChoice: 'vegetarian',
      submittedAt: '2026-08-19T12:00:00.000Z',
    });

    const payload = buildCoupleProjectionPayload();
    expect(payload.events).toHaveLength(1);
    expect(payload.events[0].sourceCoupleId).toBe(event.id);
    expect(payload.events[0].title).toBe('Ada & Alan');
    expect(payload.events[0].status).toBe('lead');
    expect(payload.events[0].startDate).toBe('2027-06-12');
    expect(payload.events[0].guestCount).toBe(80);

    expect(payload.guests).toHaveLength(1);
    expect(payload.guests[0].sourceGuestId).toBe(guest.id);
    expect(payload.guests[0].sourceCoupleId).toBe(event.id);
    expect(payload.guests[0].fullName).toBe('Grace Hopper');
    expect(payload.guests[0].rsvpStatus).toBe('confirmed');
    expect(payload.guests[0].portalToken).toBeTruthy();
    expect(payload.guests[0].portalAccess.enabled).toBe(true);

    expect(payload.submissions).toHaveLength(1);
    expect(payload.submissions[0].sourceGuestId).toBe(guest.id);
    expect(payload.submissions[0].attending).toBe(true);
    expect(payload.submissions[0].mealChoice).toBe('vegetarian');
  });

  it('does not leak another couple into a scoped snapshot projection', () => {
    const first = createCoupleEvent({ coupleName: 'First', eventDate: '2027-05-01' });
    const second = createCoupleEvent({ coupleName: 'Second', eventDate: '2027-06-01' });
    addCoupleGuest(first.id, { name: 'A' });
    addCoupleGuest(second.id, { name: 'B' });

    const payload = buildCoupleProjectionPayload();
    expect(payload.events.map((e) => e.sourceCoupleId).sort()).toEqual([first.id, second.id].sort());
    expect(payload.guests).toHaveLength(2);
    expect(payload.guests.filter((g) => g.sourceCoupleId === first.id)).toHaveLength(1);
    expect(payload.guests.filter((g) => g.sourceCoupleId === second.id)).toHaveLength(1);
  });
});

describe('couple projection cloud seam', () => {
  it('stays a no-op until Supabase is configured', async () => {
    const { isCoupleProjectionEnabled, syncCoupleRelationalProjection } = await import('./coupleProjection');
    expect(isCoupleProjectionEnabled()).toBe(false);
    await expect(
      syncCoupleRelationalProjection({ organizationId: 'org', userId: 'u' }),
    ).resolves.toBe(false);
  });
});
