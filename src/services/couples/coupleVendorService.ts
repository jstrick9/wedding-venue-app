import { CoupleVendor } from '../../types';
import { Vendor } from '../../types/vendor';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const KEY = STORAGE_KEYS.COUPLE_VENDORS;
const VERSION = STORAGE_VERSIONS.COUPLE_VENDORS;

function readAll(): CoupleVendor[] {
  return loadVersionedStorage<CoupleVendor[]>({
    key: KEY,
    defaultValue: [],
    currentVersion: VERSION,
    validate: (v): v is CoupleVendor[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
}

function writeAll(vendors: CoupleVendor[]): void {
  saveVersionedStorage(KEY, VERSION, vendors);
}

/** The couple's vendor list for one event. */
export function getCoupleVendors(coupleEventId: string): CoupleVendor[] {
  return readAll()
    .filter((v) => v.coupleEventId === coupleEventId)
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** Backup read — all couple vendors across every couple. */
export function getCoupleVendorsForBackup(): CoupleVendor[] {
  return readAll();
}

/** Add a vendor to the couple's list (custom or picked from the venue's preferred list). */
export function addCoupleVendor(
  coupleEventId: string,
  input: {
    name: string;
    category: string;
    source: CoupleVendor['source'];
    venueVendorId?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    website?: string;
    notes?: string;
    cost?: number;
  },
): CoupleVendor | null {
  const name = input.name.trim();
  if (!name) return null;
  // Prevent duplicate picks (by venue vendor id or by name).
  const existing = readAll().filter((v) => v.coupleEventId === coupleEventId);
  if (input.venueVendorId && existing.some((v) => v.venueVendorId === input.venueVendorId)) return null;
  if (!input.venueVendorId && existing.some((v) => v.name.trim().toLowerCase() === name.toLowerCase())) return null;
  const vendor: CoupleVendor = {
    id: `cv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    coupleEventId,
    name,
    category: input.category.trim() || 'other',
    source: input.source,
    venueVendorId: input.venueVendorId,
    contactName: input.contactName?.trim() || undefined,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    website: input.website?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    status: 'requested',
    cost: input.cost,
    createdAt: new Date().toISOString(),
  };
  writeAll([...readAll(), vendor]);
  return vendor;
}

export function updateCoupleVendor(
  coupleEventId: string,
  vendorId: string,
  updates: Partial<Pick<CoupleVendor, 'status' | 'cost' | 'notes' | 'contactName' | 'email' | 'phone' | 'website'>>,
): void {
  writeAll(
    readAll().map((v) =>
      v.id === vendorId && v.coupleEventId === coupleEventId ? { ...v, ...updates } : v,
    ),
  );
}

export function removeCoupleVendor(coupleEventId: string, vendorId: string): void {
  writeAll(readAll().filter((v) => !(v.id === vendorId && v.coupleEventId === coupleEventId)));
}

/** Remove all vendors for a couple event (on delete). */
export function removeCoupleVendors(coupleEventId: string): void {
  writeAll(readAll().filter((v) => v.coupleEventId !== coupleEventId));
}

/**
 * The venue's preferred vendor list (vendors flagged isPreferred). Couples can
 * pick from these (read-only reference) or add their own custom vendors.
 */
export function getVenuePreferredVendors(allVendors: Vendor[]): Vendor[] {
  return allVendors
    .filter((v) => v.isPreferred)
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}
