import { describe, expect, it } from 'vitest';
import { formatMapCoordinates, mapBounds, markerColor, parseMapPoint } from './platformMapGeometry';

describe('platformMapGeometry', () => {
  it('colors venue markers by lifecycle status', () => {
    expect(markerColor('active')).toBe('#2563eb');
    expect(markerColor('provisioning')).toBe('#d97706');
    expect(markerColor('suspended')).toBe('#dc2626');
  });

  it('pads a continental default when no venues are located', () => {
    expect(mapBounds([])).toMatchObject({ minLon: -130, maxLat: 50 });
  });

  it('accepts numeric strings and rejects incomplete or NaN coordinates', () => {
    expect(parseMapPoint({ latitude: '35.227', longitude: '-80.8431' })).toEqual({
      latitude: 35.227,
      longitude: -80.8431,
    });
    expect(parseMapPoint({ latitude: 35.227, longitude: null })).toBeNull();
    expect(parseMapPoint({ latitude: Number.NaN, longitude: -80.8 })).toBeNull();
    expect(formatMapCoordinates({ latitude: 35.227, longitude: undefined })).toBe('Pending');
  });
});
