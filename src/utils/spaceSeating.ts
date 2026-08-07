/**
 * Venue-side seating verification for the Design Studio. Because guest management
 * lives in the couples portal, the venue admin needs a quick check that the placed
 * seating in a space will seat every couple booked into that space.
 */

export interface SpaceCoupleSeating {
  coupleName: string;
  guestCount?: number;
}

export interface SpaceSeatingInfo {
  /** Largest expected guest count across the booked couples (0 if none). */
  expectedGuests: number;
  /** True when the placed seats exceed the venue's maximum capacity. */
  overVenueCapacity: boolean;
  /** True when the placed seats cannot seat the largest expected guest count. */
  underCapacity: boolean;
  /** True when any couple is booked into this space. */
  hasCouples: boolean;
}

/**
 * Pure helper used by the Design Studio capacity indicator.
 */
export function computeSpaceSeating(
  placedSeats: number,
  venueCapacity: number,
  couples: SpaceCoupleSeating[],
): SpaceSeatingInfo {
  const expectedGuests = couples.reduce((m, c) => Math.max(m, c.guestCount || 0), 0);
  return {
    expectedGuests,
    overVenueCapacity: placedSeats > venueCapacity,
    underCapacity: expectedGuests > 0 && expectedGuests > placedSeats,
    hasCouples: couples.length > 0,
  };
}
