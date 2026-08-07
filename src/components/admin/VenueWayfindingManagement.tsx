import { useState } from 'react';
import { useConfirm } from '../useConfirm';
import type { AdminCommonProps } from './AdminTabTypes';
import {
  VenueMapConfig,
  VenueMapPoint,
  RainContingency,
  VenueWeatherConfig,
} from '../../types';
import {
  getVenueMapConfig,
  saveVenueMapConfig,
  emptyVenueMapConfig,
  getVenueRules,
  saveVenueRules,
  routePolyline,
} from '../../services/wayfinding/venueWayfindingService';
import {
  getVenueWeather,
  setDayWeather,
  removeDayWeather,
  saveVenueWeather,
  fetchWeatherForecast,
} from '../../services/weather/venueWeatherService';

interface Props {
  config: AdminCommonProps['config'];
  venues: AdminCommonProps['venues'];
  onShowSuccess: (msg: string) => void;
}

const KIND_LABEL: Record<VenueMapPoint['kind'], string> = {
  space: 'Venue Space',
  parking: 'Parking',
  entry: 'Entry',
  amenity: 'Amenity',
  path: 'Path',
};

/**
 * Venue-controlled wayfinding — the venue builds the full property map (spaces,
 * parking, entry, amenities), marks rain-contingency backups, and sets venue
 * rules/regulations. The couple's guest portal surfaces the subset relevant to
 * that couple.
 */
export function VenueWayfindingManagement({ venues, onShowSuccess }: Props) {
  const { confirm, confirmDialog } = useConfirm();
  const [map, setMap] = useState<VenueMapConfig | null>(() => getVenueMapConfig());
  const [rules, setRules] = useState<string[]>(() => getVenueRules().rules);
  const [newRule, setNewRule] = useState('');
  const [newPoint, setNewPoint] = useState({ label: '', kind: 'space' as VenueMapPoint['kind'], x: 50, y: 50, venueId: '', lat: '', lng: '' });
  // Route builder state
  const [routeName, setRouteName] = useState('');
  const [routePointIds, setRoutePointIds] = useState<string[]>([]);

  // Weather state
  const [weather, setWeather] = useState(() => getVenueWeather());
  const [weatherLocation, setWeatherLocation] = useState(() => getVenueWeather().location || '');
  const [weatherFetching, setWeatherFetching] = useState(false);
  // Manual forecast form fields
  const [wfDate, setWfDate] = useState('');
  const [wfCondition, setWfCondition] = useState('');
  const [wfTempLow, setWfTempLow] = useState('');
  const [wfTempHigh, setWfTempHigh] = useState('');
  const [wfRain, setWfRain] = useState('');

  const addManualForecast = () => {
    if (!wfDate || !wfCondition.trim()) {
      onShowSuccess('Enter a date and condition to add a forecast.');
      return;
    }
    if (wfTempLow !== '' && wfTempHigh !== '' && Number(wfTempLow) > Number(wfTempHigh)) {
      onShowSuccess("Low temperature can't be above high temperature.");
      return;
    }
    if (wfRain !== '' && (Number(wfRain) < 0 || Number(wfRain) > 100)) {
      onShowSuccess('Rain chance must be between 0 and 100.');
      return;
    }
    setDayWeather(wfDate, {
      condition: wfCondition.trim(),
      tempLow: wfTempLow !== '' ? Number(wfTempLow) : undefined,
      tempHigh: wfTempHigh !== '' ? Number(wfTempHigh) : undefined,
      rainChance: wfRain !== '' ? Number(wfRain) : undefined,
    });
    setWeather(getVenueWeather());
    setWfDate('');
    setWfCondition('');
    setWfTempLow('');
    setWfTempHigh('');
    setWfRain('');
    onShowSuccess('Forecast added.');
  };

  const updateWeather = (cfg: VenueWeatherConfig) => {
    setWeather(cfg);
    saveVenueWeather(cfg);
  };

  const ensureMap = (): VenueMapConfig => map || emptyVenueMapConfig();
  const update = (next: VenueMapConfig) => {
    setMap(next);
    saveVenueMapConfig(next);
  };

  const addPoint = () => {
    // Validate GPS coordinates when provided (both must be valid, or neither).
    const latS = newPoint.lat.trim();
    const lngS = newPoint.lng.trim();
    const latN = latS === '' ? undefined : Number(latS);
    const lngN = lngS === '' ? undefined : Number(lngS);
    const latValid = latN === undefined || (Number.isFinite(latN) && latN >= -90 && latN <= 90);
    const lngValid = lngN === undefined || (Number.isFinite(lngN) && lngN >= -180 && lngN <= 180);
    if (!latValid || !lngValid) {
      onShowSuccess('Latitude must be -90 to 90 and longitude -180 to 180. Enter both, or leave both blank.');
      return;
    }
    if ((latN === undefined) !== (lngN === undefined)) {
      onShowSuccess('Enter both latitude and longitude (or leave both blank).');
      return;
    }
    // Validate the SVG x/y coordinates so a NaN or out-of-bounds value can't break
    // the map rendering (an invalid <circle cx=NaN> silently breaks wayfinding).
    const xN = Number(newPoint.x);
    const yN = Number(newPoint.y);
    if (!Number.isFinite(xN) || !Number.isFinite(yN) || xN < 0 || yN < 0) {
      onShowSuccess('X and Y must be valid coordinates (0 or greater).');
      return;
    }
    const m = ensureMap();
    const mWidth = m.width || 1000;
    const mHeight = m.height || 1000;
    if (xN > mWidth || yN > mHeight) {
      onShowSuccess(`Coordinates should be within the map (0–${mWidth} × 0–${mHeight}).`);
      return;
    }
    const p: VenueMapPoint = {
      id: `pt-${Date.now()}`,
      label: newPoint.label.trim() || 'Point',
      kind: newPoint.kind,
      x: xN,
      y: yN,
      venueId: newPoint.kind === 'space' ? newPoint.venueId || undefined : undefined,
      lat: latN,
      lng: lngN,
    };
    update({ ...m, points: [...m.points, p], updatedAt: new Date().toISOString() });
    setNewPoint({ label: '', kind: 'space', x: 50, y: 50, venueId: '', lat: '', lng: '' });
  };

  const removePoint = (id: string) => {
    const m = ensureMap();
    update({
      ...m,
      points: m.points.filter((p) => p.id !== id),
      routes: (m.routes || []).map((r) => ({ ...r, pointIds: r.pointIds.filter((pid) => pid !== id) })),
      updatedAt: new Date().toISOString(),
    });
  };

  const addRoute = () => {
    if (routePointIds.length < 2) {
      onShowSuccess('A walkway needs at least 2 points. Add more points to the path first.');
      return;
    }
    const m = ensureMap();
    const route = {
      id: `route-${Date.now()}`,
      name: routeName.trim() || 'Path',
      pointIds: routePointIds,
    };
    update({ ...m, routes: [...(m.routes || []), route], updatedAt: new Date().toISOString() });
    setRouteName('');
    setRoutePointIds([]);
  };

  const removeRoute = (id: string) => {
    const m = ensureMap();
    update({ ...m, routes: (m.routes || []).filter((r) => r.id !== id), updatedAt: new Date().toISOString() });
  };

  // Rain contingency: for each outdoor venue the couple might use, pick an indoor backup.
  const outdoorVenues = venues.filter((v) => v.category === 'outdoor' || v.category === 'ceremony');
  const indoorVenues = venues.filter((v) => v.category !== 'outdoor' && v.category !== 'ceremony');

  const addContingency = () => {
    const m = ensureMap();
    const outdoorVenueId = outdoorVenues[0]?.id;
    const indoorVenueId = indoorVenues[0]?.id;
    if (!outdoorVenueId || !indoorVenueId) return;
    const c: RainContingency = {
      id: `rc-${Date.now()}`,
      outdoorVenueId,
      indoorVenueId,
    };
    update({ ...m, rainContingencies: [...m.rainContingencies, c], updatedAt: new Date().toISOString() });
  };

  const updateContingency = (id: string, patch: Partial<RainContingency>) => {
    const m = ensureMap();
    update({
      ...m,
      rainContingencies: m.rainContingencies.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      updatedAt: new Date().toISOString(),
    });
  };

  const removeContingency = (id: string) => {
    const m = ensureMap();
    update({
      ...m,
      rainContingencies: m.rainContingencies.filter((c) => c.id !== id),
      updatedAt: new Date().toISOString(),
    });
  };

  const addRule = () => {
    if (!newRule.trim()) return;
    setRules((prev) => [...prev, newRule.trim()]);
    setNewRule('');
  };

  const saveRules = () => {
    saveVenueRules(rules);
    onShowSuccess('Venue rules saved.');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 p-4 text-white">
        <h2 className="text-base font-bold">🗺️ Venue Wayfinding &amp; Rules</h2>
        <p className="text-xs text-white/80 mt-1">
          Build the full property map (spaces, parking, entry), set rain-contingency
          backups, and define venue rules. Couples see the subset relevant to their event.
        </p>
      </div>

      {/* Map preview + builder */}
      <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Property Map</h3>
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({ title: 'Reset venue map?', message: 'This removes all points, paths, and rain-contingency backups.', tone: 'danger', confirmLabel: 'Reset' });
              if (ok) update(emptyVenueMapConfig());
            }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Reset map
          </button>
        </div>
        {map && map.points.length > 0 ? (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <svg viewBox={`0 0 ${map.width} ${map.height}`} className="w-full h-64 bg-teal-50">
              {(map.routes || []).map((route) => {
                const pts = routePolyline(map, route.id);
                if (pts.length < 2) return null;
                return (
                  <polyline
                    key={route.id}
                    points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth={1}
                    strokeDasharray="2,1.5"
                  />
                );
              })}
              {map.points
                .filter((p) => p.kind === 'path')
                .map((p) => (
                  <circle key={p.id} cx={p.x} cy={p.y} r={1.5} fill="#94a3b8" />
                ))}
              {map.points
                .filter((p) => p.kind !== 'path')
                .map((p) => {
                  const color =
                    p.kind === 'space' ? '#0d9488' : p.kind === 'parking' ? '#6366f1' : p.kind === 'entry' ? '#16a34a' : '#f59e0b';
                  return (
                    <g key={p.id}>
                      <circle cx={p.x} cy={p.y} r={4} fill={color} stroke="white" strokeWidth={1} />
                      <text x={p.x + 5} y={p.y - 3} fontSize={5} fill="#374151">{p.label}</text>
                    </g>
                  );
                })}
            </svg>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 px-6 py-8 text-center text-gray-400 text-sm">
            No points yet. Add spaces, parking, and entries below to build the map.
          </div>
        )}

        {/* Add point */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-6 gap-2">
          <input
            type="text"
            placeholder="Label"
            value={newPoint.label}
            onChange={(e) => setNewPoint({ ...newPoint, label: e.target.value })}
            className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Point label"
          />
          <select
            value={newPoint.kind}
            onChange={(e) => setNewPoint({ ...newPoint, kind: e.target.value as VenueMapPoint['kind'] })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            aria-label="Point kind"
          >
            {(Object.keys(KIND_LABEL) as VenueMapPoint['kind'][]).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="X"
            value={newPoint.x}
            onChange={(e) => setNewPoint({ ...newPoint, x: Number(e.target.value) })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="X coordinate"
          />
          <input
            type="number"
            placeholder="Y"
            value={newPoint.y}
            onChange={(e) => setNewPoint({ ...newPoint, y: Number(e.target.value) })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Y coordinate"
          />
          <input
            type="text"
            placeholder="Lat"
            value={newPoint.lat}
            onChange={(e) => setNewPoint({ ...newPoint, lat: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Latitude (GPS)"
          />
          <input
            type="text"
            placeholder="Lng"
            value={newPoint.lng}
            onChange={(e) => setNewPoint({ ...newPoint, lng: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Longitude (GPS)"
          />
          <button
            type="button"
            onClick={addPoint}
            className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
          >
            + Add
          </button>
        </div>
        {newPoint.kind === 'space' && (
          <div className="mt-2">
            <select
              value={newPoint.venueId}
              onChange={(e) => setNewPoint({ ...newPoint, venueId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              aria-label="Linked venue space"
            >
              <option value="">Link to a venue space…</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Points list */}
        {map && map.points.length > 0 && (
          <div className="mt-3 space-y-1">
            {map.points.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {p.label} <span className="text-gray-400 text-xs">({KIND_LABEL[p.kind]}, {p.x},{p.y})</span>
                </span>
                <button type="button" onClick={() => removePoint(p.id)} className="text-red-400 hover:text-red-600" aria-label={`Remove ${p.label}`}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Routes / paths */}
      <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-2">🛤️ Walkways &amp; Paths</h3>
        <p className="text-xs text-gray-500 mb-3">
          Draw a walkway by naming it and selecting the points it connects in order
          (e.g. Main Entry → Ceremony Garden). Paths render as dashed polylines.
        </p>
        {map && map.points.length > 0 ? (
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="Route name"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              aria-label="Route name"
            />
            <select
              multiple
              value={routePointIds}
              onChange={(e) =>
                setRoutePointIds(Array.from(e.target.selectedOptions).map((o) => o.value))
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              aria-label="Route points (in order)"
            >
              {map.points
                .filter((p) => p.kind !== 'path')
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
            </select>
            <button
              type="button"
              onClick={addRoute}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
            >
              + Add path
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Add points first to draw paths between them.</p>
        )}

        <div className="space-y-1">
          {(map?.routes || []).map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">
                {r.name} <span className="text-gray-400 text-xs">({r.pointIds.length} points)</span>
              </span>
              <button type="button" onClick={() => removeRoute(r.id)} className="text-red-400 hover:text-red-600" aria-label={`Remove ${r.name}`}>
                ✕
              </button>
            </div>
          ))}
          {(!map || !map.routes || map.routes.length === 0) && (
            <p className="text-xs text-gray-400">No paths drawn yet.</p>
          )}
        </div>
      </div>

      {/* Rain contingency */}
      <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">🌧️ Rain Contingency</h3>
          <button
            type="button"
            onClick={addContingency}
            className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
            disabled={outdoorVenues.length === 0 || indoorVenues.length === 0}
          >
            + Add backup
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          When a couple selects an outdoor space, the guest portal also surfaces the indoor
          backup you choose here (e.g. a rain contingency for the outdoor ceremony).
        </p>
        <div className="space-y-2">
          {(map?.rainContingencies || []).map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-sm">
              <select
                value={c.outdoorVenueId}
                onChange={(e) => updateContingency(c.id, { outdoorVenueId: e.target.value })}
                className="px-2 py-1 border border-gray-300 rounded-lg text-sm bg-white"
                aria-label="Outdoor space"
              >
                {outdoorVenues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <span>→</span>
              <select
                value={c.indoorVenueId}
                onChange={(e) => updateContingency(c.id, { indoorVenueId: e.target.value })}
                className="px-2 py-1 border border-gray-300 rounded-lg text-sm bg-white"
                aria-label="Indoor backup"
              >
                {indoorVenues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => removeContingency(c.id)} className="text-red-400 hover:text-red-600" aria-label="Remove backup">
                ✕
              </button>
            </div>
          ))}
          {(!map || map.rainContingencies.length === 0) && (
            <p className="text-xs text-gray-400">No rain-contingency backups set.</p>
          )}
        </div>
      </div>

      {/* Venue rules */}
      <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-2">📜 Venue Rules &amp; Regulations</h3>
        <div className="space-y-2 mb-3">
          {rules.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-gray-700">{r}</span>
              <button
                type="button"
                onClick={() => setRules(rules.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600"
                aria-label="Remove rule"
              >
                ✕
              </button>
            </div>
          ))}
          {rules.length === 0 && <p className="text-xs text-gray-400">No rules yet.</p>}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            placeholder="Add a rule or regulation (Enter)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Add rule"
          />
          <button type="button" onClick={addRule} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700">
            Add
          </button>
          <button type="button" onClick={saveRules} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
            Save rules
          </button>
        </div>
      </div>

      {/* Weather */}
      <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-2">🌤️ Weather Forecast</h3>
        <p className="text-xs text-gray-500 mb-3">
          Enter a forecast per event day (shown alongside the couple's timeline in their
          guest portal), or auto-fetch from a free weather API by entering a location.
        </p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={weatherLocation}
            onChange={(e) => setWeatherLocation(e.target.value)}
            placeholder="Location, e.g. Charlotte, NC"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Weather location"
          />
          <button
            type="button"
            onClick={async () => {
              if (!weatherLocation.trim()) {
                onShowSuccess('Enter a location first, e.g. Charlotte, NC.');
                return;
              }
              setWeatherFetching(true);
              try {
                const forecasts = await fetchWeatherForecast(weatherLocation.trim());
                const dates = Object.keys(forecasts);
                if (dates.length === 0) {
                  onShowSuccess(`Couldn't find a forecast for "${weatherLocation.trim()}". Try a more specific location, or enter the forecast manually.`);
                } else {
                  updateWeather({
                    location: weatherLocation.trim(),
                    forecasts: { ...weather.forecasts, ...forecasts },
                    updatedAt: new Date().toISOString(),
                  });
                  onShowSuccess(`Loaded ${dates.length} day${dates.length === 1 ? '' : 's'} of weather for ${weatherLocation.trim()}.`);
                }
              } catch {
                onShowSuccess('Weather fetch failed. Check your connection or enter the forecast manually.');
              } finally {
                setWeatherFetching(false);
              }
            }}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
            disabled={weatherFetching}
          >
            {weatherFetching ? 'Fetching…' : 'Auto-fetch'}
          </button>
        </div>

        {/* Manual entry per event day */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Add forecast for a date</label>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={wfDate}
              onChange={(e) => setWfDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              aria-label="Forecast date"
            />
            <input
              type="text"
              value={wfCondition}
              onChange={(e) => setWfCondition(e.target.value)}
              placeholder="Condition (e.g. Sunny)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              aria-label="Forecast condition"
            />
            <input
              type="number"
              value={wfTempLow}
              onChange={(e) => setWfTempLow(e.target.value)}
              placeholder="Low °F"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-24"
              aria-label="Forecast low temperature"
            />
            <input
              type="number"
              value={wfTempHigh}
              onChange={(e) => setWfTempHigh(e.target.value)}
              placeholder="High °F"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-24"
              aria-label="Forecast high temperature"
            />
            <input
              type="number"
              value={wfRain}
              onChange={(e) => setWfRain(e.target.value)}
              placeholder="Rain %"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-24"
              aria-label="Forecast rain chance"
            />
            <button
              type="button"
              onClick={addManualForecast}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
            >
              Add
            </button>
          </div>
        </div>

        {/* Forecast list */}
        <div className="space-y-2">
          {Object.entries(weather.forecasts).length === 0 ? (
            <p className="text-xs text-gray-400">No forecasts entered yet.</p>
          ) : (
            Object.entries(weather.forecasts).map(([date, f]) => (
              <div key={date} className="flex items-center gap-2 text-sm">
                <span className="w-24 text-gray-600">{date}</span>
                <span className="flex-1 text-gray-800">{f.condition}</span>
                {f.tempLow != null && f.tempHigh != null && <span className="text-gray-500">{f.tempLow}°–{f.tempHigh}°</span>}
                {f.rainChance != null && <span className="text-blue-500">☔ {f.rainChance}%</span>}
                <button
                  type="button"
                  onClick={() => {
                    removeDayWeather(date);
                    setWeather(getVenueWeather());

                  }}
                  className="text-red-400 hover:text-red-600"
                  aria-label={`Remove forecast for ${date}`}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
