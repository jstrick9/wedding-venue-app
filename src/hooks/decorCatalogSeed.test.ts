import { describe, it, expect, beforeEach } from 'vitest';
import { getDecorCategories, getDecorItems, setDecorCategories, setDecorItems } from './useLayoutState';

describe('decor catalog first-use seeding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds starter categories + items when nothing is stored yet', () => {
    const cats = getDecorCategories();
    const items = getDecorItems();
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.some((c) => c.id === 'florals')).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.id === 'decor-rose-centerpiece')).toBe(true);
  });

  it('does NOT overwrite explicitly-saved (even empty) data', () => {
    setDecorCategories([]);
    setDecorItems([]);
    expect(getDecorCategories()).toEqual([]);
    expect(getDecorItems()).toEqual([]);
  });

  it('returns the user&#39;s own saved catalog once saved', () => {
    setDecorCategories([{ id: 'custom', name: 'Mine', color: '#000' }]);
    setDecorItems([{ id: 'x', name: 'X', categoryId: 'custom', color: '#000' } as any]);
    const cats = getDecorCategories();
    const items = getDecorItems();
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe('Mine');
    expect(items).toHaveLength(1);
  });
});
