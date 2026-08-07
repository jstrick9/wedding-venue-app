import { beforeEach, describe, expect, it } from 'vitest';
import { createCoupleEvent, getCoupleEvents, submitCoupleLayout, reviewCoupleLayout, saveCoupleSpaceLayout, updateCoupleEvent } from './coupleService';
import { ensureDerivedGuestEventsForCouple, getCoupleGuestEvents } from './coupleGuestEventService';
import { seedDefaultWeddingPackages, findWeddingPackage, getWeddingPackages } from './couplePackageService';
import { findPackageAddOn } from './coupleAddOnService';

/**
 * Venue-admin persona: creating a couple event, assigning a package, and
 * processing layout approval — the day-to-day couples & events workflow.
 */
describe('venue admin couples & events flow', () => {
  beforeEach(() => {
    localStorage.clear();
    seedDefaultWeddingPackages();
  });

  it('creates a couple event and lists it', () => {
    const ev = createCoupleEvent({ coupleName: 'Smith & Jones', guestCount: 120, eventDate: '2026-09-12' });
    expect(getCoupleEvents()).toHaveLength(1);
    expect(ev.status).toBe('invited');
    expect(ev.inviteToken).toBeTruthy();
    expect(ev.days).toHaveLength(1);
  });

  it('derives guest events from the assigned package when the venue opens the itinerary', () => {
    seedDefaultWeddingPackages();
    const pkg = getWeddingPackages()[0];
    const ev = createCoupleEvent({ coupleName: 'Lee & Park', packageId: pkg?.id, guestCount: 150 });
    ensureDerivedGuestEventsForCouple(ev, pkg, findPackageAddOn);
    // Core events (ceremony, cocktail, reception) always derive.
    const titles = getCoupleGuestEvents(ev.id).map((g) => g.title);
    expect(titles).toContain('Ceremony');
    expect(titles).toContain('Reception');
  });

  it('walks the layout approval workflow: submit -> pending -> approve', () => {
    const ev = createCoupleEvent({ coupleName: 'Brown & Davis', eventDate: '2026-10-01' });
    updateCoupleEvent(ev.id, { selectedSpaces: ['ballroom'] });
    saveCoupleSpaceLayout(ev.id, 'ballroom', {
      tables: [{ id: 'T1', type: 'table', specId: 'round', x: 10, y: 10, rotation: 0, label: 'T1', guests: [] }],
      fixtures: [], decor: [], updatedAt: new Date().toISOString(),
    } as any);
    const submitted = submitCoupleLayout(ev.id, { byName: 'Couple' });
    expect(submitted?.layoutStatus).toBe('pending');
    const approved = reviewCoupleLayout(ev.id, 'approve', { byName: 'Venue' });
    expect(approved?.layoutStatus).toBe('approved');
  });

  it('completing an event locks planning on the couple side', () => {
    const ev = createCoupleEvent({ coupleName: 'Wilson & Moore' });
    const done = updateCoupleEvent(ev.id, { status: 'completed' });
    expect(done?.status).toBe('completed');
  });
});
