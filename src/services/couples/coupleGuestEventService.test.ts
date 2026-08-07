import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCoupleGuestEvents,
  addCoupleGuestEvent,
  updateCoupleGuestEvent,
  removeCoupleGuestEvent,
  getCoupleGuestEventsForBackup,
  removeCoupleGuestEvents,
  assignGuestToEvent,
  removeGuestFromEvent,
  getAssignedGuestCount,
  deriveGuestEvents,
  ensureDerivedGuestEvents,
} from './coupleGuestEventService';
import { addCoupleGuest, getCoupleGuests } from './coupleGuestService';
import { getCoupleRsvpSubmissions, setCoupleRsvpSubmissions } from './coupleRsvpService';

describe('coupleGuestEventService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds and scopes guest events per couple', () => {
    addCoupleGuestEvent('e1', { title: 'Ceremony', kind: 'ceremony', capacity: 200 });
    addCoupleGuestEvent('e1', { title: 'Rehearsal', kind: 'rehearsal-dinner', capacity: 50 });
    addCoupleGuestEvent('e2', { title: 'Other', kind: 'custom', capacity: 10 });
    expect(getCoupleGuestEvents('e1')).toHaveLength(2);
    expect(getCoupleGuestEvents('e2')).toHaveLength(1);
  });

  it('updates and removes events', () => {
    const ev = addCoupleGuestEvent('e1', { title: 'Reception', kind: 'reception', capacity: 200 })!;
    updateCoupleGuestEvent('e1', ev.id, { capacity: 250 });
    expect(getCoupleGuestEvents('e1')[0].capacity).toBe(250);
    removeCoupleGuestEvent('e1', ev.id);
    expect(getCoupleGuestEvents('e1')).toHaveLength(0);
  });

  it('assigns and unassigns guests to events with capacity counts', () => {
    addCoupleGuestEvent('e1', { title: 'Ceremony', kind: 'ceremony', capacity: 200 });
    const g1 = addCoupleGuest('e1', { name: 'A' });
    const g2 = addCoupleGuest('e1', { name: 'B' });
    const ev = getCoupleGuestEvents('e1')[0];
    assignGuestToEvent('e1', g1.id, ev.id);
    assignGuestToEvent('e1', g2.id, ev.id);
    expect(getAssignedGuestCount('e1', ev.id)).toBe(2);
    removeGuestFromEvent('e1', g1.id, ev.id);
    expect(getAssignedGuestCount('e1', ev.id)).toBe(1);
    expect(getCoupleGuests('e1').find((g) => g.id === g2.id)?.guestEventIds).toEqual([ev.id]);
  });

  it('removing an event unassigns it from guests', () => {
    addCoupleGuestEvent('e1', { title: 'Ceremony', kind: 'ceremony', capacity: 200 });
    const g = addCoupleGuest('e1', { name: 'A' });
    const ev = getCoupleGuestEvents('e1')[0];
    assignGuestToEvent('e1', g.id, ev.id);
    removeCoupleGuestEvent('e1', ev.id);
    expect(getCoupleGuests('e1')[0].guestEventIds || []).toEqual([]);
  });

  it('removing an event scrubs stale attendingEvents from RSVPs', () => {
    addCoupleGuestEvent('e1', { title: 'Ceremony', kind: 'ceremony', capacity: 200 });
    const g = addCoupleGuest('e1', { name: 'A' });
    const ev = getCoupleGuestEvents('e1')[0];
    setCoupleRsvpSubmissions('e1', [{ id: 'r1', guestId: g.id, attending: true, attendingEvents: [ev.id, 'other-event'], eventKey: 'e1' } as any]);
    removeCoupleGuestEvent('e1', ev.id);
    const rsvps = getCoupleRsvpSubmissions('e1');
    expect(rsvps[0].attendingEvents).toEqual(['other-event']);
  });

  it('derives guest events from package and add-ons', () => {
    const pkg = {
      durationType: 'full-weekend',
      maxGuests: 250,
      maxOvernightGuests: 40,
      lodgingIncluded: true,
      includedItems: ['rehearsal-setup'],
    } as any;
    const addOns = [{ id: 'a1', name: 'Horse Ride', category: 'activity', price: 650 }] as any;
    const events = deriveGuestEvents(pkg, addOns);
    const titles = events.map((e) => e.title);
    expect(titles).toContain('Rehearsal Dinner');
    expect(titles).toContain('Ceremony');
    expect(titles).toContain('Reception');
    expect(titles).toContain('Overnight Lodging');
    expect(titles).toContain('Horse Ride');
    const lodging = events.find((e) => e.kind === 'lodging');
    expect(lodging?.capacity).toBe(40);
  });

  it('seeds default guest events once', () => {
    const pkg = { durationType: 'single-day', maxGuests: 200, maxOvernightGuests: 0, lodgingIncluded: false, includedItems: [] } as any;
    ensureDerivedGuestEvents('e1', pkg, []);
    const count = getCoupleGuestEvents('e1').length;
    // single-day w/o rehearsal-setup include => ceremony + cocktail + reception
    expect(count).toBe(3);
    ensureDerivedGuestEvents('e1', pkg, []);
    expect(getCoupleGuestEvents('e1').length).toBe(count);
    expect(getCoupleGuestEventsForBackup().length).toBe(count);
  });

  it('adds a guest event for a new add-on later without duplicating core events', () => {
    const pkg = { durationType: 'single-day', maxGuests: 200, maxOvernightGuests: 0, lodgingIncluded: false, includedItems: [] } as any;
    // Initial: seeds ceremony + cocktail + reception (3 core events).
    ensureDerivedGuestEvents('e2', pkg, []);
    const before = getCoupleGuestEvents('e2').map((e) => e.title);
    expect(before).toHaveLength(3);

    // Couple later adds a horse & carriage activity add-on.
    const addOns = [{ id: 'a1', name: 'Horse & Carriage', category: 'activity', price: 500 }] as any;
    ensureDerivedGuestEvents('e2', pkg, addOns);

    const after = getCoupleGuestEvents('e2');
    // Core events are not duplicated; the new activity event is added once.
    expect(after).toHaveLength(4);
    expect(after.filter((e) => e.title === 'Horse & Carriage')).toHaveLength(1);

    // Calling again is still idempotent.
    ensureDerivedGuestEvents('e2', pkg, addOns);
    expect(getCoupleGuestEvents('e2')).toHaveLength(4);
  });

  it('removes all events for a couple on cleanup', () => {
    addCoupleGuestEvent('e1', { title: 'A', kind: 'custom', capacity: 1 });
    addCoupleGuestEvent('e2', { title: 'B', kind: 'custom', capacity: 1 });
    removeCoupleGuestEvents('e1');
    expect(getCoupleGuestEvents('e1')).toHaveLength(0);
    expect(getCoupleGuestEvents('e2')).toHaveLength(1);
  });
});
