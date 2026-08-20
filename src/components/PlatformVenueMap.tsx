import { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { PlatformOrganizationSummary } from '../services/platform/platformTypes';
import { isSupabaseConfigured } from '../services/backend/supabaseClient';
import { fetchGeoapifyTile } from '../services/platform/geocodingService';
import { formatMapCoordinates, mapBounds, markerColor, parseMapPoint } from '../utils/platformMapGeometry';

interface PlatformVenueMapProps {
  organizations: PlatformOrganizationSummary[];
}

type MapView = 'points' | 'density' | 'regions';

const FALLBACK_CENTER: [number, number] = [39.8, -98.5];

function waitForMapSize(element: HTMLElement): Promise<boolean> {
  if (element.clientWidth > 0 && element.clientHeight > 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    let attempts = 0;
    const tick = () => {
      if (element.clientWidth > 0 && element.clientHeight > 0) {
        resolve(true);
        return;
      }
      if (attempts++ > 30) {
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export default function PlatformVenueMap({ organizations }: PlatformVenueMapProps) {
  const [view, setView] = useState<MapView>('points');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tileError, setTileError] = useState('');
  const mapNode = useRef<HTMLDivElement | null>(null);
  const located = organizations.flatMap((organization) => {
    const point = parseMapPoint(organization);
    return point ? [{ organization, ...point }] : [];
  });
  const selected = organizations.find((organization) => organization.id === selectedId);
  const bounds = useMemo(
    () => mapBounds(located.map((item) => ({ latitude: item.latitude, longitude: item.longitude }))),
    [located],
  );
  const locatedKey = located.map((item) => `${item.organization.id}:${item.latitude}:${item.longitude}`).join('|');
  const useTiles = isSupabaseConfigured() && view === 'points';
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

  useEffect(() => {
    if (!useTiles || !mapNode.current) return;
    let cancelled = false;
    let map: { remove: () => void } | null = null;
    const pins = located;
    setTileError('');
    void import('leaflet').then(async (mod) => {
      const container = mapNode.current;
      if (cancelled || !container) return;
      const sized = await waitForMapSize(container);
      if (cancelled || !mapNode.current) return;
      if (!sized) {
        setTileError('The map container has no size yet. Switch tabs and open Map again.');
        return;
      }
      const L = (mod as { default?: typeof import('leaflet') }).default ?? (mod as typeof import('leaflet'));
      const center = pins[0] ? [pins[0].latitude, pins[0].longitude] as [number, number] : FALLBACK_CENTER;
      const leafletMap = L.map(container, { scrollWheelZoom: true, fadeAnimation: false }).setView(center, pins.length ? 6 : 4);
      leafletMap.invalidateSize();
      class GeoapifyAuthedTiles extends L.GridLayer {
        createTile(coords: { x: number; y: number; z: number }, done: (error?: Error, tile?: HTMLElement) => void) {
          const img = document.createElement('img');
          img.alt = '';
          void fetchGeoapifyTile(coords.z, coords.x, coords.y)
            .then((blob) => {
              const url = URL.createObjectURL(blob);
              img.onload = () => {
                URL.revokeObjectURL(url);
                done(undefined, img);
              };
              img.onerror = () => done(new Error('Could not decode map tile.'), img);
              img.src = url;
            })
            .catch((error) => {
              setTileError(error instanceof Error ? error.message : 'Could not load Geoapify tiles.');
              done(error instanceof Error ? error : new Error('tile'), img);
            });
          return img;
        }
      }
      new GeoapifyAuthedTiles({
        tileSize: 256,
        attribution: 'Powered by Geoapify | © OpenMapTiles © OpenStreetMap contributors',
      }).addTo(leafletMap);
      pins.forEach((item) => {
        const marker = L.circleMarker([item.latitude, item.longitude], {
          radius: selectedId === item.organization.id ? 10 : 7,
          color: '#ffffff',
          weight: 2,
          fillColor: markerColor(item.organization.status),
          fillOpacity: 0.95,
        }).addTo(leafletMap);
        marker.bindPopup(`<strong>${item.organization.name}</strong><br/>${[item.organization.city, item.organization.stateRegion].filter(Boolean).join(', ')}`);
        marker.on('click', () => setSelectedId(item.organization.id));
      });
      if (pins.length > 0 && leafletMap.getSize().x > 0 && leafletMap.getSize().y > 0) {
        const group = L.latLngBounds(pins.map((item) => [item.latitude, item.longitude] as [number, number]));
        leafletMap.fitBounds(group.pad(pins.length === 1 ? 0.4 : 0.2), { maxZoom: 12, animate: false });
      }
      map = leafletMap;
    }).catch((error) => {
      if (!cancelled) setTileError(error instanceof Error ? error.message : 'Could not start the map.');
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [useTiles, locatedKey]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="Platform venue map">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Geographic operations</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">Venue network map</h2>
          <p className="mt-1 text-xs text-gray-500">Street tiles come from Geoapify through the server proxy. Use the table for exact values and actions.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {([['points', 'Point map'], ['density', 'Density'], ['regions', 'Regions']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setView(id)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === id ? 'bg-indigo-700 text-white' : 'text-gray-600 hover:bg-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      {view !== 'regions' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-slate-100">
          {useTiles ? (
            <div
              ref={mapNode}
              className="w-full"
              style={{ height: 360, width: '100%', minHeight: 360 }}
              aria-label="Geoapify map of venue organizations"
            />
          ) : (
            <svg viewBox="0 0 800 360" role="img" aria-label={view === 'points' ? 'Point map of venue organizations' : 'Venue organization density map'} className="h-auto w-full">
              <rect x="0" y="0" width="800" height="360" fill="#eef2f7" />
              {[0, 1, 2, 3, 4].map((line) => <line key={`h-${line}`} x1="0" x2="800" y1={40 + line * 70} y2={40 + line * 70} stroke="#dbe3ed" strokeWidth="1" />)}
              {[0, 1, 2, 3, 4, 5, 6].map((line) => <line key={`v-${line}`} x1={40 + line * 120} x2={40 + line * 120} y1="0" y2="360" stroke="#dbe3ed" strokeWidth="1" />)}
              {view === 'points' && located.map((item) => {
                const position = point(item.latitude, item.longitude);
                return <g key={item.organization.id} tabIndex={0} role="button" aria-label={`${item.organization.name}, ${item.organization.status}`} onClick={() => setSelectedId(item.organization.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(item.organization.id); }} className="cursor-pointer"><circle cx={position.x} cy={position.y} r={selectedId === item.organization.id ? 11 : 8} fill={markerColor(item.organization.status)} stroke="#fff" strokeWidth="3" /><text x={position.x + 12} y={position.y + 4} fontSize="11" fill="#334155">{item.organization.name}</text></g>;
              })}
              {view === 'density' && Array.from({ length: 32 }).map((_, index) => {
                const col = index % 8;
                const row = Math.floor(index / 8);
                const x0 = 40 + col * 90;
                const y0 = 20 + row * 78;
                const count = located.filter((item) => {
                  const p = point(item.latitude, item.longitude);
                  return p.x >= x0 && p.x < x0 + 90 && p.y >= y0 && p.y < y0 + 78;
                }).length;
                const alpha = count === 0 ? 0.05 : Math.min(0.85, 0.15 + count / Math.max(1, located.length));
                return <rect key={index} x={x0} y={y0} width="88" height="76" fill={`rgba(37,99,235,${alpha})`} />;
              })}
            </svg>
          )}
        </div>
      )}

      {view === 'regions' && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{regions.map(([region, count]) => <button key={region} type="button" onClick={() => setSelectedId(organizations.find((organization) => (organization.stateRegion || organization.country || 'Unknown') === region)?.id || null)} className="rounded-xl border border-indigo-200 p-3 text-left" style={{ backgroundColor: `rgba(37,99,235,${0.08 + 0.72 * (count / maxRegion)})` }}><p className="text-xs font-bold text-indigo-950">{region}</p><p className="mt-1 text-xl font-extrabold text-indigo-950">{count}</p><p className="text-[11px] text-indigo-900">venue{count === 1 ? '' : 's'}</p></button>)}</div>}

      {located.length === 0 && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">No venues have coordinates yet. Verify a street address during venue setup to place them on the map.</p>}
      {tileError && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{tileError}</p>}
      {selected && <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4"><p className="text-sm font-bold text-indigo-950">{selected.name}</p><p className="mt-1 text-xs text-indigo-900">{selected.addressLine1}, {selected.city}, {selected.stateRegion} {selected.postalCode}</p><p className="mt-1 text-xs text-indigo-900">Status: {selected.status} · Admins: {selected.admins.length}</p></div>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200"><table className="min-w-full text-left text-xs"><caption className="sr-only">Venue map data table</caption><thead className="bg-gray-50 font-bold text-gray-600"><tr><th className="px-3 py-2">Venue</th><th className="px-3 py-2">Region</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Coordinates</th></tr></thead><tbody>{organizations.map((organization) => <tr key={organization.id} className="border-t border-gray-100"><td className="px-3 py-2 font-semibold text-gray-800">{organization.name}</td><td className="px-3 py-2 text-gray-600">{organization.city}, {organization.stateRegion}</td><td className="px-3 py-2 text-gray-600">{organization.status}</td><td className="px-3 py-2 text-gray-600">{formatMapCoordinates(organization)}</td></tr>)}</tbody></table></div>
      <p className="mt-2 text-[11px] text-gray-400">Map tiles: Powered by Geoapify | © OpenMapTiles © OpenStreetMap contributors. Density and region views stay schematic. Floor-plan designer is unchanged.</p>
    </section>
  );
}
