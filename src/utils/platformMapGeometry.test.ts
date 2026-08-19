import { describe, expect, it } from 'vitest';
import { mapBounds, markerColor } from './platformMapGeometry';

describe('platformMapGeometry', () => {
  it('colors venue markers by lifecycle status', () => {
    expect(markerColor('active')).toBe('#2563eb');
    expect(markerColor('provisioning')).toBe('#d97706');
    expect(markerColor('suspended')).toBe('#dc2626');
  });

  it('pads a continental default when no venues are located', () => {
    expect(mapBounds([])).toMatchObject({ minLon: -130, maxLat: 50 });
  });
});
