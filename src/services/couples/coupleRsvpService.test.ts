import { describe, it, expect, beforeEach } from 'vitest';
import { getCoupleRsvpSubmissions, setCoupleRsvpSubmissions, removeCoupleRsvp, upsertCoupleRsvp } from './coupleRsvpService';

function submission(coupleEventId: string, guestId: string, attending: boolean) {
  return {
    id: `rsvp-${guestId}`,
    guestId,
    eventName: coupleEventId,
    eventKey: coupleEventId,
    fullName: guestId,
    email: '',
    attending,
    submittedAt: new Date().toISOString(),
  };
}

describe('coupleRsvpService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and scopes RSVP submissions per couple event', () => {
    setCoupleRsvpSubmissions('e1', [submission('e1', 'g1', true)]);
    setCoupleRsvpSubmissions('e2', [submission('e2', 'g2', false)]);
    const e1 = getCoupleRsvpSubmissions('e1');
    const e2 = getCoupleRsvpSubmissions('e2');
    expect(e1).toHaveLength(1);
    expect(e1[0].guestId).toBe('g1');
    expect(e2).toHaveLength(1);
    expect(e2[0].guestId).toBe('g2');
  });

  it('replaces all submissions for an event on save (does not duplicate)', () => {
    setCoupleRsvpSubmissions('e1', [submission('e1', 'g1', true)]);
    // Save again with the same event — old entries removed, new set stored.
    setCoupleRsvpSubmissions('e1', [submission('e1', 'g1', true), submission('e1', 'g2', false)]);
    expect(getCoupleRsvpSubmissions('e1')).toHaveLength(2);
  });

  it('does not leak one event\'s submissions into another', () => {
    setCoupleRsvpSubmissions('e1', [submission('e1', 'g1', true)]);
    expect(getCoupleRsvpSubmissions('e2')).toHaveLength(0);
  });

  it('removes a guest\'s RSVP submission', () => {
    setCoupleRsvpSubmissions('e1', [submission('e1', 'g1', true), submission('e1', 'g2', false)]);
    removeCoupleRsvp('e1', 'g1');
    const remaining = getCoupleRsvpSubmissions('e1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].guestId).toBe('g2');
  });

  it('upserts a single RSVP for a guest (does not duplicate)', () => {
    upsertCoupleRsvp('e1', { ...submission('e1', 'g1', true), mealChoice: 'chicken' });
    upsertCoupleRsvp('e1', { ...submission('e1', 'g1', true), mealChoice: 'beef' });
    expect(getCoupleRsvpSubmissions('e1')).toHaveLength(1);
    expect(getCoupleRsvpSubmissions('e1')[0].mealChoice).toBe('beef');
  });

  it('upsert keeps other guests\' RSVPs and scopes by couple', () => {
    upsertCoupleRsvp('e1', { ...submission('e1', 'g1', true) });
    upsertCoupleRsvp('e1', { ...submission('e1', 'g2', false) });
    upsertCoupleRsvp('e2', { ...submission('e2', 'g9', true) });
    expect(getCoupleRsvpSubmissions('e1')).toHaveLength(2);
    expect(getCoupleRsvpSubmissions('e2')).toHaveLength(1);
  });
});
