import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

export interface VendorCategoryDef {
  id: string;
  label: string;
  icon: string;
}

const KEY = STORAGE_KEYS.VENDOR_CATEGORIES;
const VERSION = STORAGE_VERSIONS.VENDOR_CATEGORIES;

/** Sensible defaults for a full-service wedding venue. */
const DEFAULT_CATEGORIES: VendorCategoryDef[] = [
  { id: 'catering', label: 'Food & Catering', icon: '🍽️' },
  { id: 'bar', label: 'Bar Service', icon: '🍸' },
  { id: 'photography', label: 'Photography', icon: '📸' },
  { id: 'videography', label: 'Videography', icon: '🎬' },
  { id: 'florist', label: 'Floral', icon: '💐' },
  { id: 'dj-band', label: 'DJ / Band', icon: '🎵' },
  { id: 'officiant', label: 'Officiant', icon: '⛪' },
  { id: 'cake', label: 'Cake / Bakery', icon: '🎂' },
  { id: 'hair-makeup', label: 'Hair & Makeup', icon: '💄' },
  { id: 'transportation', label: 'Transportation', icon: '🚗' },
  { id: 'rentals', label: 'Rentals', icon: '🪑' },
  { id: 'coordinator', label: 'Planning & Coordination', icon: '🗂️' },
  { id: 'security', label: 'Security', icon: '🛡️' },
  { id: 'other', label: 'Other', icon: '✨' },
];

function readAll(): VendorCategoryDef[] {
  const stored = loadVersionedStorage<VendorCategoryDef[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is VendorCategoryDef[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
  if (stored.length > 0) return stored;
  // Seed on first use.
  saveVersionedStorage(KEY, VERSION, DEFAULT_CATEGORIES);
  return DEFAULT_CATEGORIES;
}

function writeAll(categories: VendorCategoryDef[]): void {
  saveVersionedStorage(KEY, VERSION, categories);
}

/** The venue's vendor categories (seeded with defaults on first use). */
export function getVendorCategories(): VendorCategoryDef[] {
  return readAll();
}

export function getVendorCategoriesForBackup(): VendorCategoryDef[] {
  return readAll();
}

export function addVendorCategory(input: { label: string; icon?: string }): VendorCategoryDef | null {
  const label = input.label.trim();
  if (!label) return null;
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `cat-${Date.now()}`;
  const cat: VendorCategoryDef = { id, label, icon: input.icon?.trim() || '✨' };
  writeAll([...readAll(), cat]);
  return cat;
}

export function updateVendorCategory(id: string, updates: Partial<Pick<VendorCategoryDef, 'label' | 'icon'>>): void {
  writeAll(readAll().map((c) => (c.id === id ? { ...c, ...updates } : c)));
}

export function removeVendorCategory(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function findVendorCategory(id: string): VendorCategoryDef | undefined {
  return readAll().find((c) => c.id === id);
}

/** Label lookup that never throws on an unknown/legacy id. */
export function vendorCategoryLabel(id: string): string {
  return findVendorCategory(id)?.label || id;
}
