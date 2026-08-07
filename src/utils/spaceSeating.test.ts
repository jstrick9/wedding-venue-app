import { describe, it, expect } from 'vitest';
import { computeSpaceSeating } from './spaceSeating';

describe('computeSpaceSeating (Design Studio venue verification)', () => {
  it('reports no couples when none are booked into the space', () => {
    const info = computeSpaceSeating(50, 60, []);
    expect(info.hasCouples).toBe(false);
    expect(info.expectedGuests).toBe(0);
    expect(info.underCapacity).toBe(false);
    expect(info.overVenueCapacity).toBe(false);
  });

  it('flags under-capacity when placed seats < largest expected guest count', () => {
    const info = computeSpaceSeating(40, 60, [
      { coupleName: 'Smith', guestCount: 30 },
      { coupleName: 'Jones', guestCount: 55 },
    ]);
    expect(info.hasCouples).toBe(true);
    expect(info.expectedGuests).toBe(55);
    expect(info.underCapacity).toBe(true);
    expect(info.overVenueCapacity).toBe(false);
  });

  it('is fine when placed seats cover the largest expected guest count', () => {
    const info = computeSpaceSeating(60, 80, [
      { coupleName: 'Lee', guestCount: 55 },
      { coupleName: 'Wu', guestCount: 60 },
    ]);
    expect(info.underCapacity).toBe(false);
    expect(info.overVenueCapacity).toBe(false);
  });

  it('flags over-venue-capacity when placed seats exceed the venue max', () => {
    const info = computeSpaceSeating(90, 80, []);
    expect(info.overVenueCapacity).toBe(true);
    expect(info.underCapacity).toBe(false);
  });

  it('ignores couples without a guest count', () => {
    const info = computeSpaceSeating(50, 60, [
      { coupleName: 'Smith', guestCount: 0 },
      { coupleName: 'Jones' },
    ]);
    expect(info.expectedGuests).toBe(0);
    expect(info.underCapacity).toBe(false);
  });
});
