import { describe, it, expect, beforeEach } from 'vitest';
import {
  addCoupleGuest,
  getCoupleGuests,
  removeCoupleGuest,
  updateCoupleGuest,
  importCoupleGuests,
  getCouplePortalConfig,
  getCoupleGuestsForBackup,
  getCouplePortalConfigsForBackup,
  getCoupleIdFromLocation,
} from './coupleGuestService';

describe('coupleGuestService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds and scopes guests per couple event', () => {
    addCoupleGuest('e1', { name: 'Alice', email: 'a@x.com' });
    addCoupleGuest('e1', { name: 'Bob' });
    addCoupleGuest('e2', { name: 'Carol' });
    expect(getCoupleGuests('e1')).toHaveLength(2);
    expect(getCoupleGuests('e2')).toHaveLength(1);
    expect(getCoupleGuestsForBackup()).toHaveLength(3);
  });

  it('gives each guest a unique token and builds an invite URL', async () => {
    const g = addCoupleGuest('e1', { name: 'Alice' });
    expect(g.token).toBeTruthy();
    const { buildGuestInviteUrl } = await import('./coupleGuestService');
    expect(buildGuestInviteUrl(g.token!)).toContain('#/guest-portal?token=');
    // Couple-scoped link must include the couple param so the guest opens the couple portal.
    expect(buildGuestInviteUrl(g.token!, 'e1')).toContain('couple=e1');
  });

  it('updates and removes guests', () => {
    const g = addCoupleGuest('e1', { name: 'Alice' });
    updateCoupleGuest('e1', g.id, { email: 'alice@x.com' });
    expect(getCoupleGuests('e1')[0].email).toBe('alice@x.com');
    removeCoupleGuest('e1', g.id);
    expect(getCoupleGuests('e1')).toHaveLength(0);
  });

  it('imports guests from CSV-style rows', () => {
    const added = importCoupleGuests('e1', [
      { name: 'Alice', email: 'a@x.com' },
      { name: 'Bob' },
      { name: '' }, // skipped
    ]);
    expect(added).toBe(2);
    expect(getCoupleGuests('e1')).toHaveLength(2);
  });

  it('creates and persists a per-couple portal config seeded from the venue', () => {
    const cfg = getCouplePortalConfig('e1', null, { coupleName: 'Smith & Jones', eventDate: '2026-06-06' });
    expect(cfg.eventTitle).toBe('Smith & Jones');
    expect(cfg.eventStartDate).toBe('2026-06-06');
    // second call returns the same stored config
    const again = getCouplePortalConfig('e1', null, { coupleName: 'Other', eventDate: '' });
    expect(again.eventTitle).toBe('Smith & Jones');
    expect(getCouplePortalConfigsForBackup().e1).toBeTruthy();
  });

  it('extracts the couple id from the guest-portal URL', () => {
    expect(getCoupleIdFromLocation({ hash: '#/guest-portal?token=x&couple=e1' } as Location)).toBe('e1');
    expect(getCoupleIdFromLocation({ hash: '#/guest-portal?token=x' } as Location)).toBeUndefined();
  });
});
