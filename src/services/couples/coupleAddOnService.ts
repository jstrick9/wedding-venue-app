import { PackageAddOn, PackageAddOnCategory } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const KEY = STORAGE_KEYS.PACKAGE_ADDONS;
const VERSION = STORAGE_VERSIONS.PACKAGE_ADDONS;

export const ADD_ON_CATEGORIES: { id: PackageAddOnCategory; label: string; icon: string }[] = [
  { id: 'lodging', label: 'Lodging', icon: '🛏️' },
  { id: 'activity', label: 'Activity', icon: '🎯' },
  { id: 'service', label: 'Service', icon: '🧑‍🍳' },
  { id: 'ceremony-reception', label: 'Ceremony/Reception', icon: '💍' },
  { id: 'animal', label: 'Animal', icon: '🐴' },
  { id: 'photography', label: 'Photography', icon: '📸' },
  { id: 'city', label: 'City', icon: '🏙️' },
  { id: 'guest', label: 'Guests', icon: '👥' },
  { id: 'time', label: 'Time', icon: '🕒' },
  { id: 'other', label: 'Other', icon: '✨' },
];

function readAll(): PackageAddOn[] {
  return loadVersionedStorage<PackageAddOn[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is PackageAddOn[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
}

function writeAll(addOns: PackageAddOn[]): void {
  saveVersionedStorage(KEY, VERSION, addOns);
}

export function getPackageAddOns(): PackageAddOn[] {
  return readAll().sort((a, b) => (a.name < b.name ? -1 : 1));
}

export function getActivePackageAddOns(): PackageAddOn[] {
  return getPackageAddOns().filter((a) => a.active);
}

export function findPackageAddOn(id?: string): PackageAddOn | undefined {
  if (!id) return undefined;
  return readAll().find((a) => a.id === id);
}

export function savePackageAddOn(input: {
  id?: string;
  name: string;
  category: PackageAddOnCategory;
  price: number;
  priceNote?: string;
  description?: string;
  venueVendorId?: string;
  active: boolean;
}): PackageAddOn {
  const existing = input.id ? readAll().find((a) => a.id === input.id) : undefined;
  const now = new Date().toISOString();
  if (existing) {
    const updated: PackageAddOn = {
      ...existing,
      name: input.name.trim(),
      category: input.category,
      price: input.price,
      priceNote: input.priceNote?.trim() || undefined,
      description: input.description?.trim() || undefined,
      venueVendorId: input.venueVendorId?.trim() || undefined,
      active: input.active,
    };
    writeAll(readAll().map((a) => (a.id === updated.id ? updated : a)));
    return updated;
  }
  const created: PackageAddOn = {
    id: `ao-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    category: input.category,
    price: input.price,
    priceNote: input.priceNote?.trim() || undefined,
    description: input.description?.trim() || undefined,
    venueVendorId: input.venueVendorId?.trim() || undefined,
    active: input.active,
    createdAt: now,
  };
  writeAll([...readAll(), created]);
  return created;
}

export function deletePackageAddOn(id: string): void {
  writeAll(readAll().filter((a) => a.id !== id));
}

/** Backup read — all add-ons. */
export function getPackageAddOnsForBackup(): PackageAddOn[] {
  return readAll();
}

/** Seed the venue with common add-ons (idempotent). */
export function seedDefaultPackageAddOns(): void {
  if (readAll().length > 0) return;
  const now = new Date().toISOString();
  const mk = (
    name: string,
    category: PackageAddOnCategory,
    price: number,
    priceNote?: string,
    description?: string,
  ): PackageAddOn => ({
    id: `ao-${Math.random().toString(36).slice(2, 8)}`,
    name,
    category,
    price,
    priceNote,
    description,
    active: true,
    createdAt: now,
  });
  writeAll([
    mk('Horse & Carriage', 'ceremony-reception', 650, 'max 2 hours'),
    mk('Mini Horse & Carriage', 'ceremony-reception', 350, 'max 1 hour'),
    mk('Guided Activities', 'activity', 450, 'per hour'),
    mk('Decorating Services', 'service', 250, 'per hour'),
    mk('Day of Coordination', 'service', 1000),
    mk('Design Consultation', 'service', 150),
    mk('Pressed Tablecloths', 'service', 775, 'up to 22 linens'),
    mk('Drapery in Grove Chapel', 'ceremony-reception', 1000),
    mk('Firework Sendoff', 'ceremony-reception', 700, 'weather permitting'),
    mk('Additional Venue Area', 'ceremony-reception', 750),
    mk('Additional Catering Tent', 'ceremony-reception', 450),
    mk('Cake Cutting Service', 'service', 100),
    mk('Early Venue Arrival', 'time', 500, 'per hour'),
    mk('Late Checkout', 'time', 500),
    mk('Additional Guests', 'guest', 150, 'per group of 10'),
    mk("Mini Horse 'Hoofy Nay Nay' Encounter", 'animal', 250, '1 hour'),
    mk('Non-SPM Engagement Session', 'photography', 175, 'per hour'),
    mk('Non-SPM Bridal Session', 'photography', 150, 'per hour'),
    mk('City Progressive Rehearsal Dinner', 'city', 750),
    mk('City Gaming Rehearsal Dinner', 'city', 1800),
    mk('Groomsmen Casino Play', 'city', 500, 'up to 2 hours'),
  ]);
}
