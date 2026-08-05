import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCoupleVendors,
  addCoupleVendor,
  updateCoupleVendor,
  removeCoupleVendor,
  getCoupleVendorsForBackup,
  removeCoupleVendors,
  getVenuePreferredVendors,
} from './coupleVendorService';

describe('coupleVendorService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds and scopes vendors per couple event', () => {
    addCoupleVendor('e1', { name: 'ACME Catering', category: 'catering', source: 'custom' });
    addCoupleVendor('e2', { name: 'Other', category: 'florist', source: 'custom' });
    expect(getCoupleVendors('e1')).toHaveLength(1);
    expect(getCoupleVendors('e2')).toHaveLength(1);
  });

  it('prevents duplicate venue preferred-vendor picks', () => {
    const first = addCoupleVendor('e1', { name: 'ACME', category: 'catering', source: 'preferred', venueVendorId: 'v1' });
    expect(first).not.toBeNull();
    expect(addCoupleVendor('e1', { name: 'ACME', category: 'catering', source: 'preferred', venueVendorId: 'v1' })).toBeNull();
  });

  it('updates vendor status/cost and removes vendors', () => {
    const v = addCoupleVendor('e1', { name: 'ACME', category: 'catering', source: 'custom' })!;
    updateCoupleVendor('e1', v.id, { status: 'booked', cost: 5000 });
    const stored = getCoupleVendors('e1')[0];
    expect(stored.status).toBe('booked');
    expect(stored.cost).toBe(5000);
    removeCoupleVendor('e1', v.id);
    expect(getCoupleVendors('e1')).toHaveLength(0);
  });

  it('removes all vendors for a couple on cleanup and backs up all', () => {
    addCoupleVendor('e1', { name: 'A', category: 'x', source: 'custom' });
    addCoupleVendor('e1', { name: 'B', category: 'y', source: 'custom' });
    addCoupleVendor('e2', { name: 'C', category: 'z', source: 'custom' });
    expect(getCoupleVendorsForBackup()).toHaveLength(3);
    removeCoupleVendors('e1');
    expect(getCoupleVendors('e1')).toHaveLength(0);
    expect(getCoupleVendors('e2')).toHaveLength(1);
  });

  it('filters the venue preferred vendor list', () => {
    const vendors = [
      { id: 'v1', name: 'Pref Caterer', category: 'catering', isPreferred: true } as any,
      { id: 'v2', name: 'Regular', category: 'florist', isPreferred: false } as any,
      { id: 'v3', name: 'Another Pref', category: 'photography', isPreferred: true } as any,
    ];
    const prefs = getVenuePreferredVendors(vendors);
    expect(prefs).toHaveLength(2);
    expect(prefs.map((v) => v.name)).toEqual(['Another Pref', 'Pref Caterer']);
  });
});
