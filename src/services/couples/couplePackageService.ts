import {
  WeddingPackage,
  WeddingPackageDuration,
  WeddingSeasonPrice,
  CoupleEvent,
} from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const KEY = STORAGE_KEYS.WEDDING_PACKAGES;
const VERSION = STORAGE_VERSIONS.WEDDING_PACKAGES;

/**
 * The venue's catalog of items a package can include. Used for the "included
 * items" list and to auto-suggest setup tasks. Based on a full-service venue's
 * rental inclusions (mirrors Seven Paths Manor's stated inclusions).
 */
export const INCLUDED_ITEMS: { id: string; label: string }[] = [
  { id: 'exclusive-use', label: 'Exclusive venue use' },
  { id: 'ceremony-locations', label: 'Multiple ceremony locations' },
  { id: 'tables-chairs', label: 'Tables & chairs (round/rect/sweetheart)' },
  { id: 'photo-sessions', label: 'Engagement + bridal photo sessions' },
  { id: 'shuttle', label: 'On-site golf-cart shuttle' },
  { id: 'rain-contingency', label: 'Inclement weather planning' },
  { id: 'borrowed-collection', label: 'Something Borrowed decor collection' },
  { id: 'dance-floor', label: 'Dance floor' },
  { id: 'sound', label: 'Outdoor sound systems' },
  { id: 'heaters-firepits', label: 'Heaters & fire pits' },
  { id: 'dressing-suites', label: 'Dressing suites (Manor House)' },
  { id: 'caterer-prep', label: 'Caterer prep station' },
  { id: 'security', label: 'On-site security' },
  { id: 'parking', label: 'On-site parking' },
  { id: 'trash', label: 'Trash service' },
  { id: 'linens', label: 'Linens (white or black)' },
  { id: 'pool-hot-tub', label: 'Pool & hot tub access' },
  { id: 'rehearsal-setup', label: 'Rehearsal dinner setup (tables/chairs)' },
  { id: 'cocktail-area', label: 'Cocktail hour area' },
  { id: 'golf-cart-access', label: 'Weekend golf cart access' },
  { id: 'ranch-activities', label: 'Ranch/guided activities access' },
  { id: 'overnight-stay', label: 'Overnight stay (see lodging)' },
];

export const PACKAGE_DURATIONS: { id: WeddingPackageDuration; label: string }[] = [
  { id: 'single-day', label: 'Single Day' },
  { id: 'multi-day', label: 'Multi-Day' },
  { id: 'full-weekend', label: 'Full Weekend' },
];

export function emptySeasonPrice(): WeddingSeasonPrice {
  return { nonPeak: 0, peak: 0, premier: 0 };
}

function readAll(): WeddingPackage[] {
  return loadVersionedStorage<WeddingPackage[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is WeddingPackage[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
}

function writeAll(packages: WeddingPackage[]): void {
  saveVersionedStorage(KEY, VERSION, packages);
}

export function getWeddingPackages(): WeddingPackage[] {
  return readAll().sort((a, b) => (a.name < b.name ? -1 : 1));
}

export function getActiveWeddingPackages(): WeddingPackage[] {
  return getWeddingPackages().filter((p) => p.active);
}

export function findWeddingPackage(id?: string): WeddingPackage | undefined {
  if (!id) return undefined;
  return readAll().find((p) => p.id === id);
}

export function saveWeddingPackage(input: {
  id?: string;
  name: string;
  description?: string;
  durationType: WeddingPackageDuration;
  price: WeddingSeasonPrice;
  maxGuests: number;
  maxOvernightGuests: number;
  lodgingIncluded: boolean;
  includedLodgingVenueIds?: string[];
  includedItems: string[];
  active: boolean;
}): WeddingPackage {
  const existing = input.id ? readAll().find((p) => p.id === input.id) : undefined;
  const now = new Date().toISOString();
  if (existing) {
    const updated: WeddingPackage = {
      ...existing,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      durationType: input.durationType,
      price: input.price,
      maxGuests: input.maxGuests,
      maxOvernightGuests: input.maxOvernightGuests,
      lodgingIncluded: input.lodgingIncluded,
      includedLodgingVenueIds: input.includedLodgingVenueIds,
      includedItems: input.includedItems,
      active: input.active,
      updatedAt: now,
    };
    writeAll(readAll().map((p) => (p.id === updated.id ? updated : p)));
    return updated;
  }
  const created: WeddingPackage = {
    id: `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    durationType: input.durationType,
    price: input.price,
    maxGuests: input.maxGuests,
    maxOvernightGuests: input.maxOvernightGuests,
    lodgingIncluded: input.lodgingIncluded,
    includedLodgingVenueIds: input.includedLodgingVenueIds,
    includedItems: input.includedItems,
    active: input.active,
    createdAt: now,
    updatedAt: now,
  };
  writeAll([...readAll(), created]);
  return created;
}

export function deleteWeddingPackage(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id));
}

/** Backup read — all packages. */
export function getWeddingPackagesForBackup(): WeddingPackage[] {
  return readAll();
}

/**
 * Seed the venue with an initial set of packages mirroring a full-service
 * venue's tiers (single-day, multi-day, full weekend) at season prices. Idempotent:
 * only seeds when no packages exist yet.
 */
export function seedDefaultWeddingPackages(): void {
  if (readAll().length > 0) return;
  const now = new Date().toISOString();
  const mk = (
    name: string,
    durationType: WeddingPackageDuration,
    price: WeddingSeasonPrice,
    maxGuests: number,
    maxOvernightGuests: number,
    lodgingIncluded: boolean,
    includedItems: string[],
    includedLodgingVenueIds?: string[],
  ): WeddingPackage => ({
    id: `pkg-${Math.random().toString(36).slice(2, 8)}`,
    name,
    durationType,
    price,
    maxGuests,
    maxOvernightGuests,
    lodgingIncluded,
    includedLodgingVenueIds,
    includedItems,
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  const baseIncludes = [
    'exclusive-use',
    'ceremony-locations',
    'tables-chairs',
    'photo-sessions',
    'shuttle',
    'rain-contingency',
    'borrowed-collection',
    'dance-floor',
    'sound',
    'heaters-firepits',
    'dressing-suites',
    'caterer-prep',
    'security',
    'parking',
    'trash',
    'linens',
  ];

  writeAll([
    mk(
      'Single Day — Saturday',
      'single-day',
      { nonPeak: 8800, peak: 9800, premier: 10800 },
      200,
      0,
      false,
      [...baseIncludes, 'cocktail-area'],
    ),
    mk(
      'Single Day — Friday',
      'single-day',
      { nonPeak: 7800, peak: 8800, premier: 9800 },
      200,
      0,
      false,
      baseIncludes,
    ),
    mk(
      '2-Day (no overnight)',
      'multi-day',
      { nonPeak: 8800, peak: 9800, premier: 10800 },
      200,
      0,
      false,
      [...baseIncludes, 'rehearsal-setup'],
    ),
    mk(
      '2-Day with Overnight (25 guests)',
      'multi-day',
      { nonPeak: 12800, peak: 13800, premier: 14800 },
      200,
      25,
      true,
      [...baseIncludes, 'rehearsal-setup', 'overnight-stay', 'pool-hot-tub'],
    ),
    mk(
      'Full Weekend (40 guests)',
      'full-weekend',
      { nonPeak: 19800, peak: 20800, premier: 21800 },
      250,
      40,
      true,
      [
        ...baseIncludes,
        'rehearsal-setup',
        'overnight-stay',
        'pool-hot-tub',
        'golf-cart-access',
        'ranch-activities',
        'cocktail-area',
      ],
    ),
  ]);
}

/** Suggested setup tasks based on a package's included items + couple's spaces. */
export function suggestSetupTaskTitles(pkg: WeddingPackage): string[] {
  const titles: string[] = [];
  if (pkg.includedItems.includes('tables-chairs')) titles.push('Move tables & chairs into spaces');
  if (pkg.includedItems.includes('dance-floor')) titles.push('Install dance floor');
  if (pkg.includedItems.includes('linens')) titles.push('Set out linens');
  if (pkg.includedItems.includes('borrowed-collection')) titles.push('Pull Something Borrowed decor items');
  if (pkg.includedItems.includes('caterer-prep')) titles.push('Prepare caterer prep station');
  if (pkg.includedItems.includes('ceremony-locations')) titles.push('Set up ceremony location(s)');
  if (pkg.includedItems.includes('rehearsal-setup')) titles.push('Set up rehearsal dinner tables/chairs');
  if (pkg.includedItems.includes('overnight-stay') || pkg.maxOvernightGuests > 0) titles.push('Prepare lodging suites for overnight guests');
  if (pkg.includedItems.includes('pool-hot-tub')) titles.push('Ready pool & hot tub area');
  if (pkg.includedItems.includes('cocktail-area')) titles.push('Set up cocktail hour area');
  return titles;
}

/**
 * Assign a package to a couple event and auto-suggest the venue's setup tasks
 * (marked suggested) so the venue can accept/edit them. Existing manual tasks are
 * preserved.
 */
export function assignPackageToCouple(
  event: CoupleEvent,
  packageId: string,
  addSetupTasks: (titles: string[], spaceId?: string) => void,
): CoupleEvent {
  const updated: CoupleEvent = { ...event, packageId, updatedAt: new Date().toISOString() };
  const pkg = findWeddingPackage(packageId);
  if (pkg) {
    const titles = suggestSetupTaskTitles(pkg);
    addSetupTasks(titles, event.selectedSpaces?.[0]);
  }
  return updated;
}
