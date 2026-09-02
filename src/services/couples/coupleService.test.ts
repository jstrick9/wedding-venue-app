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
  setSpaceLayout,
  saveCoupleSpaceLayout,
  acceptCoupleInvite,
  rotateCoupleInviteToken,
  rotateCoupleCollaboratorToken,
  hasVenueCoordination,
} from './coupleService';
import { addCoupleGuest, getCoupleGuests } from './coupleGuestService';
import { getCoupleRsvpSubmissions, setCoupleRsvpSubmissions } from './coupleRsvpService';
import { getCoupleMessages, sendCoupleMessage } from './coupleChatService';
import { getCoupleAnswers, saveCoupleAnswers } from './coupleAnswersService';

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

  it('creates a stable email-backed owner for a new personal account invite', () => {
    const ev = createCoupleEvent({
      coupleName: 'Adams & Lee',
      primaryEmail: '  Couple@Example.com ',
    });
    expect(ev.primaryEmail).toBe('couple@example.com');
    expect(ev.personalAccountRequired).toBe(true);
    expect(ev.collaborators).toHaveLength(1);
    expect(ev.collaborators[0]).toEqual(expect.objectContaining({
      id: `col-${ev.id}-owner`,
      email: 'couple@example.com',
      inviteToken: ev.inviteToken,
      personalAccountRequired: true,
    }));
  });

  it('rotates only the primary owner link and preserves a co-owner identity', () => {
    const ev = createCoupleEvent({ coupleName: 'Stable & Owner', primaryEmail: 'owner@example.com' });
    const coOwner = addCoupleCollaborator(ev.id, {
      name: 'Second Partner',
      email: 'second@example.com',
      role: 'couple',
    })!;
    const oldPrimaryToken = ev.inviteToken;
    const nextPrimaryToken = rotateCoupleInviteToken(ev.id);
    const current = getCoupleEvents()[0];
    expect(nextPrimaryToken).toBeTruthy();
    expect(nextPrimaryToken).not.toBe(oldPrimaryToken);
    expect(current.collaborators.find((item) => item.id === coOwner.id)?.inviteToken).toBe(coOwner.inviteToken);
    expect(current.collaborators.find((item) => item.id === `col-${ev.id}-owner`)?.inviteToken).toBe(nextPrimaryToken);
  });

  it('does not issue a new personal-account token without a valid invitee email', () => {
    const event = createCoupleEvent({ coupleName: 'Historical Couple' });
    expect(rotateCoupleInviteToken(event.id)).toBeNull();

    const collaborator = addCoupleCollaborator(event.id, {
      name: 'Planner',
      email: 'planner@example.com',
      role: 'planner',
    })!;
    updateCoupleEvent(event.id, {
      collaborators: getCoupleEvents()[0].collaborators.map((candidate) => (
        candidate.id === collaborator.id ? { ...candidate, email: '' } : candidate
      )),
    });
    expect(rotateCoupleCollaboratorToken(event.id, collaborator.id)).toBeNull();
    expect(addCoupleCollaborator(event.id, {
      name: 'Invalid',
      email: 'not-an-email',
      role: 'family',
    })).toBeNull();
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

  it('cascade-deletes a couple event and its related data', () => {
    const ev = createCoupleEvent({ coupleName: 'Cascade & Co' });
    addCoupleGuest(ev.id, { name: 'Jane' });
    setCoupleRsvpSubmissions(ev.id, [
      { id: 'r1', guestId: 'guest-x', eventKey: ev.id, eventName: ev.id, attending: true, submittedAt: new Date().toISOString() } as any,
    ]);
    sendCoupleMessage({ coupleEventId: ev.id, senderId: 'v', senderName: 'Venue', senderSide: 'venue', message: 'hello' });
    saveCoupleAnswers(ev.id, [{ userId: 'u1', questionId: 'q1', answerValue: 'yes', eventId: ev.id }]);

    expect(getCoupleGuests(ev.id)).toHaveLength(1);
    expect(getCoupleRsvpSubmissions(ev.id)).toHaveLength(1);
    expect(getCoupleMessages(ev.id)).toHaveLength(1);
    expect(getCoupleAnswers(ev.id)).toHaveLength(1);

    deleteCoupleEvent(ev.id);

    expect(getCoupleEvents()).toHaveLength(0);
    expect(getCoupleGuests(ev.id)).toHaveLength(0);
    expect(getCoupleRsvpSubmissions(ev.id)).toHaveLength(0);
    expect(getCoupleMessages(ev.id)).toHaveLength(0);
    expect(getCoupleAnswers(ev.id)).toHaveLength(0);
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

  it('tracks per-space layout status and notes, and marks spaces submitted on submit', () => {
    const ev = createCoupleEvent({ coupleName: 'Spaces Test' });
    updateCoupleEvent(ev.id, { selectedSpaces: ['ceremony', 'reception'] });
    setSpaceLayout(ev.id, 'ceremony', { status: 'designed', notes: '20 round tables' });
    let current = getCoupleEvents()[0];
    expect(current.spaceLayouts!['ceremony'].status).toBe('designed');
    expect(current.spaceLayouts!['ceremony'].notes).toBe('20 round tables');
    submitCoupleLayout(ev.id, { byName: 'Couple' });
    current = getCoupleEvents()[0];
    expect(current.layoutStatus).toBe('pending');
    expect(current.spaceLayouts!['ceremony'].status).toBe('submitted');
    expect(current.spaceLayouts!['reception'].status).toBe('submitted');
  });

  it('saves a drawn layout for a space and marks it designed', () => {
    const ev = createCoupleEvent({ coupleName: 'Layout Test' });
    updateCoupleEvent(ev.id, { selectedSpaces: ['reception'] });
    saveCoupleSpaceLayout(ev.id, 'reception', {
      tables: [{ id: 't1', type: 'table', specId: 's1', x: 10, y: 10, rotation: 0, label: 'Round', guests: [] }],
      fixtures: [],
      decor: [],
      updatedAt: new Date().toISOString(),
    });
    const current = getCoupleEvents()[0];
    expect(current.spaceLayouts!['reception'].status).toBe('designed');
    expect(current.spaceLayouts!['reception'].layout?.tables).toHaveLength(1);
    expect(current.spaceLayouts!['reception'].layout!.tables[0].x).toBe(10);
  });

  it('keeps a submitted space submitted when its layout is re-saved', () => {
    const ev = createCoupleEvent({ coupleName: 'Layout Test 2' });
    updateCoupleEvent(ev.id, { selectedSpaces: ['reception'] });
    setSpaceLayout(ev.id, 'reception', { status: 'submitted' });
    saveCoupleSpaceLayout(ev.id, 'reception', {
      tables: [],
      fixtures: [],
      decor: [],
      updatedAt: new Date().toISOString(),
    });
    expect(getCoupleEvents()[0].spaceLayouts!['reception'].status).toBe('submitted');
  });

  it('marks a collaborator as accepted after they resolve their invite', () => {
    const ev = createCoupleEvent({ coupleName: 'Accept Test' });
    const col = addCoupleCollaborator(ev.id, { name: 'Planner', email: 'p@x.com', role: 'planner' });
    expect(getCoupleEvents()[0].collaborators[0].accepted).toBeFalsy();
    acceptCoupleInvite(ev.id, col!.id);
    expect(getCoupleEvents()[0].collaborators[0].accepted).toBe(true);
  });

  it('derives recommended venue categories from answers', () => {
    const questions = [
      { id: 'eq-1', text: 'Will you use a ceremony space?', group: 'Ceremony' },
      { id: 'eq-2', text: 'Do you need a reception space?', group: 'Reception' },
      { id: 'eq-3', text: 'Do you need lodging?', group: 'Lodging' },
    ];
    const cats = deriveRecommendedVenueCategories(
      [
        { eventId: 'e1', userId: 'u1', questionId: 'eq-1', answerValue: 'yes' },
        { eventId: 'e1', userId: 'u1', questionId: 'eq-2', answerValue: 'yes' },
        { eventId: 'e1', userId: 'u1', questionId: 'eq-3', answerValue: 'no' },
      ],
      questions as any,
    );
    expect(cats).toContain('ceremony');
    expect(cats).toContain('reception');
    expect(cats).not.toContain('lodging');
  });

  it('maps a cocktail question to the cocktail venue category (not cocktail-hour)', () => {
    const questions = [{ id: 'eq-9', text: 'Do you want a cocktail hour space?', group: 'Reception' }];
    const cats = deriveRecommendedVenueCategories(
      [{ eventId: 'e1', userId: 'u1', questionId: 'eq-9', answerValue: 'yes' }],
      questions as any,
    );
    expect(cats).toContain('cocktail');
    expect(cats).not.toContain('cocktail-hour');
  });

  it('detects whether a couple has booked Day of Coordination service', () => {
    expect(hasVenueCoordination(null)).toBe(false);
    expect(hasVenueCoordination({ addOns: [] } as any)).toBe(false);
    expect(
      hasVenueCoordination({
        addOns: [{ id: 'a1', name: 'Day of Coordination', price: 1000 }],
      } as any),
    ).toBe(true);
    expect(hasVenueCoordination({ venueCoordinationBooked: true } as any)).toBe(
      true,
    );
  });
});
