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
