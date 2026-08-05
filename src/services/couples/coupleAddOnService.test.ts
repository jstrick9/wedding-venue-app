import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPackageAddOns,
  savePackageAddOn,
  deletePackageAddOn,
  findPackageAddOn,
  getActivePackageAddOns,
  getPackageAddOnsForBackup,
  seedDefaultPackageAddOns,
} from './coupleAddOnService';

describe('coupleAddOnService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and reads add-ons', () => {
    const a = savePackageAddOn({ name: 'Horse & Carriage', category: 'ceremony-reception', price: 650, priceNote: 'max 2 hours', active: true });
    expect(getPackageAddOns()).toHaveLength(1);
    expect(findPackageAddOn(a.id)?.price).toBe(650);
  });

  it('filters active add-ons', () => {
    savePackageAddOn({ name: 'Active', category: 'service', price: 100, active: true });
    savePackageAddOn({ name: 'Inactive', category: 'service', price: 200, active: false });
    expect(getActivePackageAddOns()).toHaveLength(1);
  });

  it('updates and deletes add-ons', () => {
    const a = savePackageAddOn({ name: 'A', category: 'other', price: 10, active: true });
    savePackageAddOn({ id: a.id, name: 'B', category: 'activity', price: 20, active: true });
    expect(findPackageAddOn(a.id)?.name).toBe('B');
    deletePackageAddOn(a.id);
    expect(getPackageAddOns()).toHaveLength(0);
  });

  it('seeds default add-ons once', () => {
    seedDefaultPackageAddOns();
    const count = getPackageAddOns().length;
    expect(count).toBeGreaterThanOrEqual(15);
    seedDefaultPackageAddOns();
    expect(getPackageAddOns().length).toBe(count);
    expect(getPackageAddOnsForBackup().length).toBe(count);
  });
});
