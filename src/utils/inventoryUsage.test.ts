import { describe, it, expect } from 'vitest';
import {
  countFixtureUsage,
  countTableUsage,
  inventoryState,
} from './inventoryUsage';

describe('inventoryUsage (Design Studio sidebar catalog)', () => {
  it('counts interior fixtures separately from exterior ones', () => {
    const placed = [
      { specId: 'arch-1', isExterior: true },
      { specId: 'arch-1', isExterior: true },
      { specId: 'arch-1', isExterior: false },
    ];
    expect(countFixtureUsage(placed, 'arch-1', true)).toBe(2);
    expect(countFixtureUsage(placed, 'arch-1', false)).toBe(1);
  });

  it('counts interior fixtures when isExterior is false', () => {
    const placed = [{ specId: 'f1', isExterior: false }];
    expect(countFixtureUsage(placed, 'f1', false)).toBe(1);
    expect(countFixtureUsage(placed, 'f1', true)).toBe(0);
  });

  it('counts tables', () => {
    expect(countTableUsage([{ specId: 't1' }, { specId: 't1' }, { specId: 't2' }], 't1')).toBe(2);
  });

  it('computes remaining and out-of-stock', () => {
    expect(inventoryState(2, 5)).toEqual({ remaining: 3, outOfStock: false });
    expect(inventoryState(5, 5)).toEqual({ remaining: 0, outOfStock: true });
    expect(inventoryState(6, 5)).toEqual({ remaining: -1, outOfStock: true });
    // No inventory limit => never out of stock.
    expect(inventoryState(10, undefined)).toEqual({ remaining: 0, outOfStock: false });
  });
});
