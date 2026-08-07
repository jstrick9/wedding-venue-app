/**
 * Inventory-usage helpers for the Design Studio's sidebar catalog.
 * Determines how many of an item's instances are already placed so the venue
 * admin can see remaining inventory and out-of-stock state per item.
 */

export interface PlacedFixtureLike {
  specId: string;
  isExterior?: boolean;
}

export interface PlacedTableLike {
  specId: string;
}

/**
 * Count placed fixtures of a given spec, splitting interior vs exterior so
 * exterior/architectural features track their own inventory independently of
 * interior fixtures that share a spec id.
 */
export function countFixtureUsage(
  placed: PlacedFixtureLike[],
  specId: string,
  isExterior: boolean,
): number {
  return placed.filter(
    (f) => f.specId === specId && (isExterior ? f.isExterior : !f.isExterior),
  ).length;
}

/** Count placed tables of a given spec. */
export function countTableUsage(placed: PlacedTableLike[], specId: string): number {
  return placed.filter((t) => t.specId === specId).length;
}

/** Compute remaining inventory and out-of-stock for an item. */
export function inventoryState(
  used: number,
  totalInventory: number | undefined,
): { remaining: number; outOfStock: boolean } {
  if (totalInventory === undefined) {
    return { remaining: 0, outOfStock: false };
  }
  const remaining = totalInventory - used;
  return { remaining, outOfStock: remaining <= 0 };
}
