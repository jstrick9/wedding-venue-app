export function parseMapCoordinate(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseMapPoint(value: { latitude?: unknown; longitude?: unknown }): { latitude: number; longitude: number } | null {
  const latitude = parseMapCoordinate(value.latitude);
  const longitude = parseMapCoordinate(value.longitude);
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function formatMapCoordinates(value: { latitude?: unknown; longitude?: unknown }): string {
  const point = parseMapPoint(value);
  if (!point) return 'Pending';
  return `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
}

export function markerColor(status: string): string {
  if (status === 'suspended') return '#dc2626';
  if (status === 'provisioning') return '#d97706';
  return '#2563eb';
}

export function mapBounds(points: Array<{ latitude: number; longitude: number }>) {
  if (points.length === 0) return { minLon: -130, maxLon: -65, minLat: 24, maxLat: 50 };
  const lons = points.map((point) => point.longitude);
  const lats = points.map((point) => point.latitude);
  const padLon = Math.max(2, (Math.max(...lons) - Math.min(...lons)) * 0.12);
  const padLat = Math.max(2, (Math.max(...lats) - Math.min(...lats)) * 0.12);
  return {
    minLon: Math.min(...lons) - padLon,
    maxLon: Math.max(...lons) + padLon,
    minLat: Math.min(...lats) - padLat,
    maxLat: Math.max(...lats) + padLat,
  };
}
