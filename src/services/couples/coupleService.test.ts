import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCoupleEvent,
  getCoupleEvents,
  updateCoupleEvent,
  deleteCoupleEvent,
  findCoupleEventByInviteToken,
  addCoupleCollaborator,
  resolveCoupleInviteToken,
  saveCoupleSession,
  loadCoupleSession,
  clearCoupleSession,
  getCoupleTokenFromLocation,
  buildEventDays,
  submitCoupleLayout,
  reviewCoupleLayout,
  deriveRecommendedVenueCategories,
} from './coupleService';

describe('coupleService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a couple event and persists it', () => {
    const ev = createCoupleEvent({ coupleName: 'Smith & Johnson', eventDate: '2026-06-06', guestCount: 120 });
    expect(ev.id).toBeTruthy();
    expect(ev.inviteToken.startsWith('cp-')).toBe(true);
    expect(ev.status).toBe('invited');
    expect(getCoupleEvents()).toHaveLength(1);
  });

  it('resolves the couple via the invite token and creates an implicit owner', () => {
    const ev = createCoupleEvent({ coupleName: 'Adams & Lee' });
    const resolved = resolveCoupleInviteToken(ev.inviteToken);
    expect(resolved).not.toBeNull();
    expect(resolved!.collaborator.role).toBe('couple');
    expect(resolved!.event.coupleName).toBe('Adams & Lee');
    // owner persisted
    expect(getCoupleEvents()[0].collaborators.some((c) => c.role === 'couple')).toBe(true);
  });

  it('adds a collaborator and resolves their token', () => {
    const ev = createCoupleEvent({ coupleName: 'Brown & Green' });
    const col = addCoupleCollaborator(ev.id, { name: 'Jane', email: 'jane@x.com', role: 'planner' });
    expect(col).not.toBeNull();
    // event status flips to active
    expect(getCoupleEvents()[0].status).toBe('active');
    const resolved = resolveCoupleInviteToken(col!.inviteToken);
    expect(resolved!.collaborator.role).toBe('planner');
    expect(findCoupleEventByInviteToken(col!.inviteToken)!.id).toBe(ev.id);
  });

  it('updates and deletes couple events', () => {
    const ev = createCoupleEvent({ coupleName: 'X & Y' });
    updateCoupleEvent(ev.id, { selectedSpaces: ['s1', 's2'] });
    expect(getCoupleEvents()[0].selectedSpaces).toEqual(['s1', 's2']);
    deleteCoupleEvent(ev.id);
    expect(getCoupleEvents()).toHaveLength(0);
  });

  it('round-trips the couple session', () => {
    const ev = createCoupleEvent({ coupleName: 'A & B' });
    saveCoupleSession(ev.id, 'col-x');
    const session = loadCoupleSession();
    expect(session).not.toBeNull();
    expect(session!.eventId).toBe(ev.id);
    clearCoupleSession();
    expect(loadCoupleSession()).toBeNull();
  });

  it('extracts the couple token from the URL hash', () => {
    const token = getCoupleTokenFromLocation({ hash: '#/couples-portal?token=abc123' } as Location);
    expect(token).toBe('abc123');
    expect(getCoupleTokenFromLocation({ hash: '#/couples-portal' } as Location)).toBeUndefined();
  });

  it('builds event days across a multi-day span', () => {
    const days = buildEventDays('2026-06-05', '2026-06-07');
    expect(days).toHaveLength(3);
    expect(days[0].date).toBe('2026-06-05');
    expect(days[2].date).toBe('2026-06-07');
  });

  it('creates an event with days for multi-day spans', () => {
    const ev = createCoupleEvent({ coupleName: 'Multi Day', eventDate: '2026-06-05', eventEndDate: '2026-06-06' });
    expect(ev.days).toHaveLength(2);
  });

  it('submits and reviews a couple layout through the work queue', () => {
    const ev = createCoupleEvent({ coupleName: 'Approval Test' });
    submitCoupleLayout(ev.id, { byName: 'Couple' });
    expect(getCoupleEvents()[0].layoutStatus).toBe('pending');
    reviewCoupleLayout(ev.id, 'approve', { byName: 'Venue', comment: 'Looks great' });
    const updated = getCoupleEvents()[0];
    expect(updated.layoutStatus).toBe('approved');
    expect(updated.layoutComment).toBe('Looks great');
    expect(updated.layoutHistory).toHaveLength(1);
  });

  it('derives recommended venue categories from answers', () => {
    const cats = deriveRecommendedVenueCategories([
      { eventId: 'e1', userId: 'u1', questionId: 'ceremony-question', answerValue: 'yes' },
      { eventId: 'e1', userId: 'u1', questionId: 'reception-question', answerValue: 'yes' },
      { eventId: 'e1', userId: 'u1', questionId: 'lodging-question', answerValue: 'no' },
    ]);
    expect(cats).toContain('ceremony');
    expect(cats).toContain('reception');
    expect(cats).not.toContain('lodging');
  });
});
