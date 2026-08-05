import { useState } from 'react';
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
  const [map, setMap] = useState<VenueMapConfig | null>(() => getVenueMapConfig());
  const [rules, setRules] = useState<string[]>(() => getVenueRules().rules);
  const [newRule, setNewRule] = useState('');
  const [newPoint, setNewPoint] = useState({ label: '', kind: 'space' as VenueMapPoint['kind'], x: 50, y: 50, venueId: '', lat: '', lng: '' });

  // Weather state
  const [weather, setWeather] = useState(() => getVenueWeather());
  const [weatherLocation, setWeatherLocation] = useState(() => getVenueWeather().location || '');
  const [weatherDates, setWeatherDates] = useState<string[]>([]);
  const [weatherFetching, setWeatherFetching] = useState(false);

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
    const m = ensureMap();
    const p: VenueMapPoint = {
      id: `pt-${Date.now()}`,
      label: newPoint.label.trim() || 'Point',
      kind: newPoint.kind,
      x: newPoint.x,
      y: newPoint.y,
      venueId: newPoint.kind === 'space' ? newPoint.venueId || undefined : undefined,
      lat: newPoint.lat !== '' ? Number(newPoint.lat) : undefined,
      lng: newPoint.lng !== '' ? Number(newPoint.lng) : undefined,
    };
    update({ ...m, points: [...m.points, p], updatedAt: new Date().toISOString() });
    setNewPoint({ label: '', kind: 'space', x: 50, y: 50, venueId: '', lat: '', lng: '' });
  };

  const removePoint = (id: string) => {
    const m = ensureMap();
    update({ ...m, points: m.points.filter((p) => p.id !== id), updatedAt: new Date().toISOString() });
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
            onClick={() => update(emptyVenueMapConfig())}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Reset map
          </button>
        </div>
        {map && map.points.length > 0 ? (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <svg viewBox={`0 0 ${map.width} ${map.height}`} className="w-full h-64 bg-teal-50">
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
              if (!weatherLocation.trim()) return;
              setWeatherFetching(true);
              const forecasts = await fetchWeatherForecast(weatherLocation.trim());
              const dates = Object.keys(forecasts);
              updateWeather({
                location: weatherLocation.trim(),
                forecasts: { ...weather.forecasts, ...forecasts },
                updatedAt: new Date().toISOString(),
              });
              if (dates.length > 0) setWeatherDates(dates);
              setWeatherFetching(false);
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
              id="weather-date-input"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              aria-label="Forecast date"
              onChange={(e) => {
                const d = e.target.value;
                if (!d) return;
                setWeatherDates((prev) => (prev.includes(d) ? prev : [...prev, d]));
              }}
            />
            <input
              type="text"
              id="weather-condition-input"
              placeholder="Condition (e.g. Sunny)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              aria-label="Forecast condition"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const date = (document.getElementById('weather-date-input') as HTMLInputElement)?.value;
                  const condition = (e.target as HTMLInputElement).value.trim();
                  if (date && condition) {
                    setDayWeather(date, { condition });
                    setWeather(getVenueWeather());
                    setWeatherDates((prev) => (prev.includes(date) ? prev : [...prev, date]));
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              }}
            />
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
                {f.tempHigh != null && <span className="text-gray-500">{f.tempHigh}°</span>}
                {f.rainChance != null && <span className="text-blue-500">☔ {f.rainChance}%</span>}
                <button
                  type="button"
                  onClick={() => {
                    removeDayWeather(date);
                    setWeather(getVenueWeather());
                    setWeatherDates((prev) => prev.filter((d) => d !== date));
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
    </div>
  );
}
