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
  setCouplePortalConfig,
  pushSharedConfigToCouples,
  rotateCoupleGuestToken,
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

  it('adds a missing invite email once, then keeps the personal-account identity fixed', () => {
    const g = addCoupleGuest('e1', { name: 'Alice' });
    expect(g.personalAccountRequired).toBe(true);
    updateCoupleGuest('e1', g.id, { email: 'alice@x.com' });
    expect(getCoupleGuests('e1')[0].email).toBe('alice@x.com');
    updateCoupleGuest('e1', g.id, { email: 'someone-else@x.com' });
    expect(getCoupleGuests('e1')[0].email).toBe('alice@x.com');
    removeCoupleGuest('e1', g.id);
    expect(getCoupleGuests('e1')).toHaveLength(0);
  });

  it('requires a valid email before a personal guest invite can be reissued', () => {
    const noEmail = addCoupleGuest('e1', { name: 'No Email' });
    expect(rotateCoupleGuestToken('e1', noEmail.id)).toBeNull();

    updateCoupleGuest('e1', noEmail.id, { email: 'guest@example.com' });
    const oldToken = getCoupleGuests('e1')[0].token;
    const nextToken = rotateCoupleGuestToken('e1', noEmail.id);
    expect(nextToken).toBeTruthy();
    expect(nextToken).not.toBe(oldToken);
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

  it('deduplicates imported guests by email and by name', () => {
    // Pre-existing guest for the couple.
    addCoupleGuest('e1', { name: 'Alice', email: 'alice@example.com' });

    const added = importCoupleGuests('e1', [
      { name: 'Alice', email: 'alice@example.com' }, // dup by email
      { name: 'Alice', email: '' },                  // dup by name
      { name: 'Bob', email: 'bob@example.com' },     // new
      { name: 'CAROL', email: 'carol@example.com' }, // new, case normalization
      { name: 'carol@example.com', email: 'CAROL@EXAMPLE.COM' }, // dup by email (case-insensitive)
    ]);
    expect(added).toBe(2); // only Bob and Carol added
    expect(getCoupleGuests('e1')).toHaveLength(3); // Alice + Bob + Carol
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

  it('pushes shared settings to couples while preserving their customizations', () => {
    // Couple config with custom hero, custom meal, and custom schedule item.
    setCouplePortalConfig('e1', {
      eventTitle: 'A & B',
      welcomeMessage: 'Custom welcome',
      heroImageUrl: 'https://x/hero.jpg',
      mealOptions: [{ value: 'custom-dish', label: 'Custom Dish' }],
      scheduleItems: [{ id: 'custom-item', title: 'Couple\'s Own Event', startTime: '' } as any],
      showMap: false,
    } as any);

    const venueConfig = {
      welcomeMessage: 'Venue welcome',
      mealOptions: [{ value: 'chicken', label: 'Chicken' }, { value: 'beef', label: 'Beef' }],
      scheduleItems: [{ id: 'v1', title: 'Cocktail Hour', startTime: '' }],
      showMap: true,
      showRSVP: true,
      accessGracePeriodHours: 48,
    } as any;

    const count = pushSharedConfigToCouples(venueConfig);
    expect(count).toBe(1);

    const updated = getCouplePortalConfigsForBackup().e1;
    // Venue message + visibility + grace period pushed.
    expect(updated.welcomeMessage).toBe('Venue welcome');
    expect(updated.showMap).toBe(true);
    expect(updated.accessGracePeriodHours).toBe(48);
    // Couple hero preserved.
    expect(updated.heroImageUrl).toBe('https://x/hero.jpg');
    // Meal options merged (venue base + couple's custom kept).
    expect(updated.mealOptions?.map((o) => o.value)).toEqual(['chicken', 'beef', 'custom-dish']);
    // Schedule items merged (venue item + couple's custom kept).
    expect(updated.scheduleItems?.map((i) => i.id)).toEqual(['v1', 'custom-item']);
  });

  it('push with no couple configs returns 0', () => {
    expect(pushSharedConfigToCouples({ welcomeMessage: 'hi' } as any)).toBe(0);
  });
});
