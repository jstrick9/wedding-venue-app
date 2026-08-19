import { useMemo, useState } from 'react';
import type { PlatformOrganizationSummary } from '../services/platform/platformTypes';

interface PlatformVenueMapProps {
  organizations: PlatformOrganizationSummary[];
}

type MapView = 'points' | 'density' | 'regions';

function markerColor(status: string): string {
  if (status === 'suspended') return '#dc2626';
  if (status === 'provisioning') return '#d97706';
  return '#2563eb';
}

export default function PlatformVenueMap({ organizations }: PlatformVenueMapProps) {
  const [view, setView] = useState<MapView>('points');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const located = organizations.filter((organization) => organization.latitude != null && organization.longitude != null);
  const selected = organizations.find((organization) => organization.id === selectedId);
  const bounds = useMemo(() => {
    if (located.length === 0) return { minLon: -130, maxLon: -65, minLat: 24, maxLat: 50 };
    const lons = located.map((organization) => Number(organization.longitude));
    const lats = located.map((organization) => Number(organization.latitude));
    const padLon = Math.max(2, (Math.max(...lons) - Math.min(...lons)) * 0.12);
    const padLat = Math.max(2, (Math.max(...lats) - Math.min(...lats)) * 0.12);
    return { minLon: Math.min(...lons) - padLon, maxLon: Math.max(...lons) + padLon, minLat: Math.min(...lats) - padLat, maxLat: Math.max(...lats) + padLat };
  }, [located]);
  const point = (latitude: number, longitude: number) => ({
    x: 40 + ((longitude - bounds.minLon) / Math.max(1, bounds.maxLon - bounds.minLon)) * 720,
    y: 330 - ((latitude - bounds.minLat) / Math.max(1, bounds.maxLat - bounds.minLat)) * 280,
  });
  const regions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const organization of organizations) {
      const region = organization.stateRegion || organization.country || 'Unknown';
      counts.set(region, (counts.get(region) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [organizations]);
  const maxRegion = Math.max(1, ...regions.map(([, count]) => count));

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="Platform venue map">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Geographic operations</p><h2 className="mt-1 text-lg font-bold text-gray-900">Venue network map</h2><p className="mt-1 text-xs text-gray-500">Use the map for geography, then use the accessible table for exact values and actions.</p></div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">{([['points', 'Point map'], ['density', 'Density'], ['regions', 'Regions']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setView(id)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === id ? 'bg-indigo-700 text-white' : 'text-gray-600 hover:bg-white'}`}>{label}</button>)}</div>
      </div>

      {view !== 'regions' && <div className="overflow-hidden rounded-xl border border-gray-200 bg-slate-100"><svg viewBox="0 0 800 360" role="img" aria-label={view === 'points' ? 'Point map of venue organizations' : 'Venue organization density map'} className="h-auto w-full">
        <rect x="0" y="0" width="800" height="360" fill="#eef2f7" />
        {[0, 1, 2, 3, 4].map((line) => <line key={`h-${line}`} x1="0" x2="800" y1={40 + line * 70} y2={40 + line * 70} stroke="#dbe3ed" strokeWidth="1" />)}
        {[0, 1, 2, 3, 4, 5, 6].map((line) => <line key={`v-${line}`} x1={40 + line * 120} x2={40 + line * 120} y1="0" y2="360" stroke="#dbe3ed" strokeWidth="1" />)}
        {view === 'points' && located.map((organization) => {
          const position = point(Number(organization.latitude), Number(organization.longitude));
          return <g key={organization.id} tabIndex={0} role="button" aria-label={`${organization.name}, ${organization.status}`} onClick={() => setSelectedId(organization.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(organization.id); }} className="cursor-pointer"><circle cx={position.x} cy={position.y} r={selectedId === organization.id ? 11 : 8} fill={markerColor(organization.status)} stroke="#fff" strokeWidth="3" /><text x={position.x + 12} y={position.y + 4} fontSize="11" fill="#334155">{organization.name}</text></g>;
        })}
        {view === 'density' && Array.from({ length: 32 }).map((_, index) => {
          const col = index % 8;
          const row = Math.floor(index / 8);
          const x0 = 40 + col * 90;
          const y0 = 20 + row * 78;
          const count = located.filter((organization) => {
            const p = point(Number(organization.latitude), Number(organization.longitude));
            return p.x >= x0 && p.x < x0 + 90 && p.y >= y0 && p.y < y0 + 78;
          }).length;
          const alpha = count === 0 ? 0.05 : Math.min(0.85, 0.15 + count / Math.max(1, located.length));
          return <rect key={index} x={x0} y={y0} width="88" height="76" fill={`rgba(37,99,235,${alpha})`} />;
        })}
      </svg></div>}

      {view === 'regions' && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{regions.map(([region, count]) => <button key={region} type="button" onClick={() => setSelectedId(organizations.find((organization) => (organization.stateRegion || organization.country || 'Unknown') === region)?.id || null)} className="rounded-xl border border-indigo-200 p-3 text-left" style={{ backgroundColor: `rgba(37,99,235,${0.08 + 0.72 * (count / maxRegion)})` }}><p className="text-xs font-bold text-indigo-950">{region}</p><p className="mt-1 text-xl font-extrabold text-indigo-950">{count}</p><p className="text-[11px] text-indigo-900">venue{count === 1 ? '' : 's'}</p></button>)}</div>}

      {located.length === 0 && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">No venues have coordinates yet. Complete address geocoding during venue setup to place them on the map.</p>}
      {selected && <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4"><p className="text-sm font-bold text-indigo-950">{selected.name}</p><p className="mt-1 text-xs text-indigo-900">{selected.addressLine1}, {selected.city}, {selected.stateRegion} {selected.postalCode}</p><p className="mt-1 text-xs text-indigo-900">Status: {selected.status} · Admins: {selected.admins.length}</p></div>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200"><table className="min-w-full text-left text-xs"><caption className="sr-only">Venue map data table</caption><thead className="bg-gray-50 font-bold text-gray-600"><tr><th className="px-3 py-2">Venue</th><th className="px-3 py-2">Region</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Coordinates</th></tr></thead><tbody>{organizations.map((organization) => <tr key={organization.id} className="border-t border-gray-100"><td className="px-3 py-2 font-semibold text-gray-800">{organization.name}</td><td className="px-3 py-2 text-gray-600">{organization.city}, {organization.stateRegion}</td><td className="px-3 py-2 text-gray-600">{organization.status}</td><td className="px-3 py-2 text-gray-600">{organization.latitude != null ? `${Number(organization.latitude).toFixed(4)}, ${Number(organization.longitude).toFixed(4)}` : 'Pending'}</td></tr>)}</tbody></table></div>
      <p className="mt-2 text-[11px] text-gray-400">Map design uses a point view, density layer, and region choropleth-style view. A future GeoJSON boundary layer can replace the region tiles without changing the metrics/table contract. Geocoding attribution: © OpenStreetMap contributors.</p>
    </section>
  );
}
