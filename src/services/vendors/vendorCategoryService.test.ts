import { describe, it, expect, beforeEach } from 'vitest';
import {
  getVendorCategories,
  addVendorCategory,
  updateVendorCategory,
  removeVendorCategory,
  findVendorCategory,
  vendorCategoryLabel,
  getVendorCategoriesForBackup,
} from './vendorCategoryService';

describe('vendorCategoryService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds default categories on first use', () => {
    const cats = getVendorCategories();
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.some((c) => c.label === 'Photography')).toBe(true);
  });

  it('adds, updates, and removes categories', () => {
    const cat = addVendorCategory({ label: 'Bar Service', icon: '🍸' });
    expect(cat).not.toBeNull();
    expect(findVendorCategory(cat!.id)?.label).toBe('Bar Service');
    updateVendorCategory(cat!.id, { label: 'Bartending' });
    expect(vendorCategoryLabel(cat!.id)).toBe('Bartending');
    removeVendorCategory(cat!.id);
    expect(findVendorCategory(cat!.id)).toBeUndefined();
  });

  it('falls back to the id for unknown categories and backs up', () => {
    expect(vendorCategoryLabel('unknown-id')).toBe('unknown-id');
    addVendorCategory({ label: 'Floral' });
    expect(getVendorCategoriesForBackup().length).toBeGreaterThan(0);
  });

  it('rejects empty labels', () => {
    expect(addVendorCategory({ label: '   ' })).toBeNull();
  });
});
