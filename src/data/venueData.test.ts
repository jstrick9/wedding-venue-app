import { describe, it, expect, beforeEach } from 'vitest';
import { defaultVenues, defaultLayoutTemplates, defaultUsers } from './venueData';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { resetToDefaults } from '../hooks/useLayoutState';

describe('defaultUsers', () => {
  it('never seeds a plaintext password (bootstrap admin is hashed + forced change)', () => {
    for (const user of defaultUsers) {
      expect(user.password).toBe('');
      if (user.passwordHash) {
        expect(user.passwordAlgorithm).toBe('pbkdf2-sha256');
        expect(user.passwordSalt).toBeTruthy();
      }
    }

    const admin = defaultUsers.find((u) => u.role === 'admin');
    expect(admin).toBeTruthy();
    // The bootstrap admin must be forced to change its known password.
    expect((admin as any).requiresPasswordChange).toBe(true);
  });

  it('bootstrap admin authenticates against the stored hash (no plaintext)', async () => {
    const { verifyPassword } = await import('../utils/auth');
    const admin = defaultUsers.find((u) => u.role === 'admin') as any;
    expect(await verifyPassword(admin, 'REPLACE_ON_FIRST_LOGIN')).toBe(true);
    expect(await verifyPassword(admin, 'wrong-password')).toBe(false);
  });
});

describe('defaultVenues', () => {
  it('seeds a venue for every built-in layout template', () => {
    const templateVenueIds = new Set(
      defaultLayoutTemplates.map((t) => t.venueId),
    );

    const seededIds = new Set(defaultVenues.map((v) => v.id));

    for (const venueId of templateVenueIds) {
      expect(
        seededIds.has(venueId),
        `template references venue "${venueId}" which is not seeded`,
      ).toBe(true);
    }
  });

  it('each default venue has a positive capacity and dimensions', () => {
    for (const venue of defaultVenues) {
      expect(venue.capacity).toBeGreaterThan(0);
      expect(venue.width).toBeGreaterThan(0);
      expect(venue.height).toBeGreaterThan(0);
      expect(venue.isMaster).toBe(true);
    }
  });
});

describe('resetToDefaults', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores every persistence domain', () => {
    // Plant some non-default values so a reset actually has work to do.
    localStorage.setItem(STORAGE_KEYS.VENUES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CHAIR_SPECS_PRIMARY, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.SPACING_SETTINGS, JSON.stringify({}));
    localStorage.setItem(STORAGE_KEYS.DECOR_PACKAGES, JSON.stringify([{}]));

    resetToDefaults();

    // Every domain should be back to a present, valid value after reset.
    const keys = [
      STORAGE_KEYS.VENUES,
      STORAGE_KEYS.TABLE_SPECS,
      STORAGE_KEYS.FIXTURE_TYPES,
      STORAGE_KEYS.GUIDELINES,
      STORAGE_KEYS.TEMPLATES,
      STORAGE_KEYS.USERS,
      STORAGE_KEYS.LINEN_COLORS,
      STORAGE_KEYS.DECOR_ITEMS,
      STORAGE_KEYS.DECOR_CATEGORIES,
      STORAGE_KEYS.DECOR_ARRANGEMENTS,
      STORAGE_KEYS.DECOR_PACKAGES,
      STORAGE_KEYS.CHAIR_SPECS_PRIMARY,
      STORAGE_KEYS.WALL_STYLES,
      STORAGE_KEYS.SPACING_SETTINGS,
      STORAGE_KEYS.ALIGNMENT_SETTINGS,
      STORAGE_KEYS.INDOOR_FEATURE_TEMPLATES,
      STORAGE_KEYS.OUTDOOR_FEATURE_TEMPLATES,
    ];

    for (const key of keys) {
      expect(
        localStorage.getItem(key),
        `expected reset to restore key "${key}"`,
      ).not.toBeNull();
    }
  });

  it('resets versioned user-data keys in the correct envelope format', () => {
    // Plant bogus raw values that would trigger a legacy-migration self-heal
    // on the next load if not reset properly.
    localStorage.setItem(STORAGE_KEYS.SAVED_LAYOUTS, JSON.stringify([{ id: 'old' }]));
    localStorage.setItem(STORAGE_KEYS.DIRECT_MESSAGES, JSON.stringify([{ id: 'm' }]));
    localStorage.setItem(STORAGE_KEYS.PORTAL_CONFIG, JSON.stringify({ eventTitle: 'Old' }));
    localStorage.setItem(STORAGE_KEYS.PORTAL_GUESTS, JSON.stringify([{ id: 'g' }]));
    localStorage.setItem(STORAGE_KEYS.RSVP_SUBMISSIONS, JSON.stringify([{ id: 'r' }]));

    resetToDefaults();

    // Each versioned key must now be a proper envelope {version, savedAt, data},
    // not a raw array/object.
    const checkEnvelope = (key: string) => {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      expect(typeof parsed.version).toBe('number');
      expect(parsed.savedAt).toBeTruthy();
      return parsed;
    };

    expect(checkEnvelope(STORAGE_KEYS.SAVED_LAYOUTS).data).toEqual([]);
    expect(checkEnvelope(STORAGE_KEYS.DIRECT_MESSAGES).data).toEqual([]);
    expect(checkEnvelope(STORAGE_KEYS.PORTAL_CONFIG).data).toBeNull();
    expect(checkEnvelope(STORAGE_KEYS.PORTAL_GUESTS).data).toEqual([]);
    expect(checkEnvelope(STORAGE_KEYS.RSVP_SUBMISSIONS).data).toEqual([]);
  });
});
