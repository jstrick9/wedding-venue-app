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
});
