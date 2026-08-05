import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWeddingPackages,
  saveWeddingPackage,
  deleteWeddingPackage,
  findWeddingPackage,
  getWeddingPackagesForBackup,
  seedDefaultWeddingPackages,
  suggestSetupTaskTitles,
  emptySeasonPrice,
  assignPackageToCouple,
} from './couplePackageService';

describe('couplePackageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and reads packages', () => {
    const p = saveWeddingPackage({
      name: 'Weekend',
      durationType: 'full-weekend',
      price: { nonPeak: 19800, peak: 20800, premier: 21800 },
      maxGuests: 250,
      maxOvernightGuests: 40,
      lodgingIncluded: true,
      includedItems: ['tables-chairs', 'dance-floor'],
      active: true,
    });
    expect(getWeddingPackages()).toHaveLength(1);
    expect(findWeddingPackage(p.id)?.maxOvernightGuests).toBe(40);
  });

  it('updates an existing package', () => {
    const p = saveWeddingPackage({ name: 'A', durationType: 'single-day', price: emptySeasonPrice(), maxGuests: 200, maxOvernightGuests: 0, lodgingIncluded: false, includedItems: [], active: true });
    saveWeddingPackage({ id: p.id, name: 'B', durationType: 'multi-day', price: emptySeasonPrice(), maxGuests: 200, maxOvernightGuests: 25, lodgingIncluded: true, includedItems: [], active: true });
    expect(getWeddingPackages()).toHaveLength(1);
    expect(findWeddingPackage(p.id)?.name).toBe('B');
  });

  it('deletes a package', () => {
    const p = saveWeddingPackage({ name: 'A', durationType: 'single-day', price: emptySeasonPrice(), maxGuests: 200, maxOvernightGuests: 0, lodgingIncluded: false, includedItems: [], active: true });
    deleteWeddingPackage(p.id);
    expect(getWeddingPackages()).toHaveLength(0);
  });

  it('seeds default packages once', () => {
    seedDefaultWeddingPackages();
    const count = getWeddingPackages().length;
    expect(count).toBeGreaterThanOrEqual(5);
    seedDefaultWeddingPackages(); // idempotent
    expect(getWeddingPackages().length).toBe(count);
    expect(getWeddingPackagesForBackup().length).toBe(count);
  });

  it('suggests setup task titles from package includes', () => {
    const titles = suggestSetupTaskTitles({
      includedItems: ['tables-chairs', 'dance-floor', 'overnight-stay'],
      maxOvernightGuests: 25,
    } as any);
    expect(titles).toContain('Move tables & chairs into spaces');
    expect(titles).toContain('Install dance floor');
    expect(titles).toContain('Prepare lodging suites for overnight guests');
  });

  it('assignPackageToCouple sets packageId and calls the setup hook', () => {
    const p = saveWeddingPackage({ name: 'Wk', durationType: 'full-weekend', price: emptySeasonPrice(), maxGuests: 200, maxOvernightGuests: 40, lodgingIncluded: true, includedItems: ['tables-chairs', 'overnight-stay'], active: true });
    let called = 0;
    const updated = assignPackageToCouple({ id: 'e1' } as any, p.id, (titles) => { called = titles.length; });
    expect(updated.packageId).toBe(p.id);
    expect(called).toBeGreaterThan(0);
  });
});
