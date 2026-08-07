import { beforeEach, describe, expect, it } from 'vitest';
import {
  createCoupleEvent, getCoupleEvents, findCoupleEventByInviteToken, resolveCoupleInviteToken,
  addCoupleCollaborator, submitCoupleLayout, reviewCoupleLayout, saveCoupleSpaceLayout,
  updateCoupleEvent, deleteCoupleEvent,
} from './coupleService';
import { saveCoupleAnswers, getCoupleAnswers } from './coupleAnswersService';
import { addCoupleChecklistItem, getCoupleChecklist, toggleCoupleChecklistItem } from './coupleChecklistService';
import { addCoupleVendor, getCoupleVendors } from './coupleVendorService';
import { addCoupleGuest, getCoupleGuests, buildGuestInviteUrl } from './coupleGuestService';
import { setCoupleRsvpSubmissions, getCoupleRsvpSubmissions } from './coupleRsvpService';

/**
 * Couple persona: the full wedding-planning journey through the real services —
 * from receiving the invite link through approving the layout and inviting guests.
 */
describe('couple persona journey', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resolves the couple invite token and opens the event', () => {
    const ev = createCoupleEvent({ coupleName: 'Smith & Jones', eventDate: '2026-09-12', guestCount: 120 });
    const resolved = resolveCoupleInviteToken(ev.inviteToken)!;
    expect(resolved.event.id).toBe(ev.id);
    expect(resolved.collaborator.role).toBe('couple');
  });

  it('couple adds collaborators (planner/family/vendor) and dedupes by email', () => {
    const ev = createCoupleEvent({ coupleName: 'Lee & Park' });
    const planner = addCoupleCollaborator(ev.id, { name: 'Event Planner', email: 'planner@x.com', role: 'planner' });
    addCoupleCollaborator(ev.id, { name: 'Mom', email: 'mom@x.com', role: 'family' });
    expect(planner).toBeTruthy();
    // Duplicate email is rejected.
    const dup = addCoupleCollaborator(ev.id, { name: 'Planner 2', email: 'planner@x.com', role: 'planner' });
    expect(dup).toBeNull();
    expect(getCoupleEvents()[0].collaborators).toHaveLength(2);
  });

  it('answers questions, selects spaces, and adds checklist + vendors', () => {
    const ev = createCoupleEvent({ coupleName: 'Brown & Davis', eventDate: '2026-10-01' });
    saveCoupleAnswers(ev.id, [{ userId: 'couple', eventId: ev.id, questionId: 'q1', answerValue: 'yes' }]);
    expect(getCoupleAnswers(ev.id)).toHaveLength(1);
    updateCoupleEvent(ev.id, { selectedSpaces: ['ballroom', 'garden'] });
    addCoupleChecklistItem(ev.id, { title: 'Finalize seating chart' });
    toggleCoupleChecklistItem(ev.id, getCoupleChecklist(ev.id)[0].id);
    addCoupleVendor(ev.id, { name: 'Florist', category: 'florist', source: 'custom' });
    expect(getCoupleChecklist(ev.id)[0].done).toBe(true);
    expect(getCoupleVendors(ev.id)).toHaveLength(1);
  });

  it('designs a layout, submits it, and the venue approves', () => {
    const ev = createCoupleEvent({ coupleName: 'Wilson & Moore', eventDate: '2026-11-05' });
    updateCoupleEvent(ev.id, { selectedSpaces: ['ballroom'] });
    saveCoupleSpaceLayout(ev.id, 'ballroom', {
      tables: [{ id: 'T1', type: 'table', specId: 'round', x: 10, y: 10, rotation: 0, label: 'T1', guests: [] }],
      fixtures: [], decor: [], updatedAt: new Date().toISOString(),
    } as any);
    submitCoupleLayout(ev.id, { byName: 'Couple' });
    expect(findCoupleEventByInviteToken(ev.inviteToken)?.layoutStatus).toBe('pending');
    reviewCoupleLayout(ev.id, 'approve', { byName: 'Venue' });
    expect(getCoupleEvents()[0].layoutStatus).toBe('approved');
  });

  it('adds guests with invite links and records RSVPs', () => {
    const ev = createCoupleEvent({ coupleName: 'Taylor & Reed' });
    const g1 = addCoupleGuest(ev.id, { name: 'Jane', email: 'jane@x.com' });
    const g2 = addCoupleGuest(ev.id, { name: 'Bob', email: 'bob@x.com' });
    expect(getCoupleGuests(ev.id)).toHaveLength(2);
    expect(g1.token).toBeTruthy();
    expect(buildGuestInviteUrl(g1.token!, ev.id)).toContain('#/guest-portal?token=');
    setCoupleRsvpSubmissions(ev.id, [
      { id: 'r1', guestId: g1.id, attending: true, mealChoice: 'chicken', eventKey: ev.id, fullName: 'Jane', email: 'jane@x.com', submittedAt: new Date().toISOString() } as any,
    ]);
    expect(getCoupleRsvpSubmissions(ev.id)).toHaveLength(1);
  });

  it('venue can complete the event, locking planning', () => {
    const ev = createCoupleEvent({ coupleName: 'Adams & Foster' });
    updateCoupleEvent(ev.id, { status: 'completed' });
    expect(getCoupleEvents()[0].status).toBe('completed');
  });

  it('deleting a couple event cleans up its guest + rsvp data', () => {
    const ev = createCoupleEvent({ coupleName: 'Garcia & Nguyen' });
    addCoupleGuest(ev.id, { name: 'Guest' });
    deleteCoupleEvent(ev.id);
    expect(getCoupleEvents()).toHaveLength(0);
    expect(getCoupleGuests(ev.id)).toHaveLength(0);
    expect(getCoupleRsvpSubmissions(ev.id)).toHaveLength(0);
  });
});
