import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultVenues, defaultLayoutTemplates } from './venueData';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { resetToDefaults } from '../hooks/useLayoutState';

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
});
