import { useEffect, useState } from 'react';
import type { AdminCommonProps } from './AdminTabTypes';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';
import { useBrandingConfig } from '../../config';
import {
  VenueMapConfig,
  VenueWeatherConfig,
} from '../../types';
import {
  getVenueMapConfig,
  getVenueMapStructuralRecoveryArtifacts,
  getVenueRules,
  saveVenueRules,
} from '../../services/wayfinding/venueWayfindingService';
import { on } from '../../utils/appEvents';
import { partitionVenueMapRainContingencyCollisions } from '../../utils/venueMapDesigner';
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
  /** Opens the dedicated full-venue map designer module in the Layout Studio. */
  onOpenVenueMap?: () => void;
}

/**
 * Venue-controlled wayfinding — the venue builds the full property map (spaces,
 * parking, entry, amenities), marks rain-contingency backups, and sets venue
 * rules/regulations. The couple's guest portal surfaces the subset relevant to
 * that couple.
 */
export function VenueWayfindingManagement({ venues, onShowSuccess, onOpenVenueMap }: Props) {
  const config = useBrandingConfig();
  const [map, setMap] = useState<VenueMapConfig | null>(() => getVenueMapConfig());
  const [rules, setRules] = useState<string[]>(() => getVenueRules().rules);
  const [newRule, setNewRule] = useState('');
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

  // Rain-contingency actions save immediately rather than maintaining a form
  // draft. Keep this state aligned with authoritative realtime hydration so an
  // old admin-tab render cannot pair a newer server revision with stale map JSON.
  useEffect(() => on('spm_data_changed', (detail) => {
    if (detail?.source !== 'backend') return;
    if (
      detail.type === 'venueMapConfigs'
      || detail.type === 'backend_hydrated'
      || detail.type === 'all'
    ) {
      setMap(getVenueMapConfig());
    }
  }), []);

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

  const addRule = () => {
    if (!newRule.trim()) return;
    setRules((prev) => [...prev, newRule.trim()]);
    setNewRule('');
  };

  const saveRules = () => {
    saveVenueRules(rules);
    onShowSuccess('Venue rules saved.');
  };

  const structuralRecoveryCount = getVenueMapStructuralRecoveryArtifacts(map).length;
  const rainPartition = map
    ? partitionVenueMapRainContingencyCollisions(map)
    : null;
  const publishableRainPlans = rainPartition?.map.rainContingencies || [];
  const quarantinedRainPlans = rainPartition?.quarantinedContingencies || [];

  return (
    <div className="space-y-4">
      <BrandedSectionHeader
        icon="🗺️"
        title="Venue Wayfinding & Rules"
        description="Build the full property map (spaces, parking, entry), set rain-contingency backups, and define venue rules. Couples see the subset relevant to their event."
        config={config}
      />

      {/* Full-venue map overview — the interactive designer lives in the Layout Studio */}
      <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">🗺️ Full-Venue Map</h3>
          {onOpenVenueMap && (
            <button
              type="button"
              onClick={onOpenVenueMap}
              className="btn-primary px-3 py-1.5 rounded-lg bg-[#4A1942] text-white text-sm font-medium hover:bg-[#3b1435]"
              style={{ backgroundColor: config.primaryColor || '#4A1942' }}
            >
              Open map designer →
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">
          The full-property map (spaces, lodging, parking, entries) is designed as its own
          module in the <span className="font-medium">Layout Studio</span>, then exported as a
          printable Venue Map for wayfinding.
        </p>
        {structuralRecoveryCount > 0 && (
          <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900" role="alert">
            <strong>Publication blocked:</strong> {structuralRecoveryCount} malformed saved map {structuralRecoveryCount === 1 ? 'occurrence needs' : 'occurrences need'} an explicit reconstruct/remove decision in the map designer. These records are withheld from portals.
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-teal-50 p-3">
            <div className="text-xl font-bold text-teal-700">{map?.points.filter((p) => p.kind === 'space').length ?? 0}</div>
            <div className="text-xs text-gray-500">Spaces</div>
          </div>
          <div className="rounded-lg bg-indigo-50 p-3">
            <div className="text-xl font-bold text-indigo-700">{map?.points.filter((p) => p.kind === 'parking').length ?? 0}</div>
            <div className="text-xs text-gray-500">Parking</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3">
            <div className="text-xl font-bold text-green-700">{map?.points.filter((p) => p.kind === 'entry').length ?? 0}</div>
            <div className="text-xs text-gray-500">Entries</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="text-xl font-bold text-amber-700">{map?.routes?.length ?? 0}</div>
            <div className="text-xs text-gray-500">Walkways</div>
          </div>
        </div>
      </div>

      {/* Rain contingencies are canonical map data. Keep this tab read-only so
          the Map Designer remains the one revision-aware writer. */}
      <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-sm">🌧️ Rain Contingency</h3>
          {onOpenVenueMap && (
            <button
              type="button"
              onClick={onOpenVenueMap}
              className="btn-primary px-3 py-1.5 rounded-lg bg-[#4A1942] text-white text-sm font-medium hover:bg-[#3b1435]"
              style={{ backgroundColor: config.primaryColor || '#4A1942' }}
            >
              Manage in map designer →
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Rain backups are published with the full Venue Map so geometry, guest scope, and
          contingency changes use one protected Save and conflict-resolution flow.
        </p>
        {quarantinedRainPlans.length > 0 && (
          <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900" role="alert">
            <strong>Publication blocked:</strong> {quarantinedRainPlans.length} duplicate or competing rain {quarantinedRainPlans.length === 1 ? 'plan requires' : 'plans require'} recovery in the map designer. Conflicting backups are withheld from portals.
          </div>
        )}
        {publishableRainPlans.length === 0 ? (
          <p className="text-xs text-gray-400">
            {quarantinedRainPlans.length > 0
              ? 'No unconflicted rain-contingency backups are currently publishable.'
              : 'No rain-contingency backups set.'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {publishableRainPlans.map((contingency, index) => (
              <li key={`${contingency.id}:${index}`} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <span className="font-medium">
                  {venues.find((venue) => venue.id === contingency.outdoorVenueId)?.name || contingency.outdoorVenueId}
                </span>
                <span className="mx-2 text-gray-400" aria-hidden="true">→</span>
                <span>
                  {venues.find((venue) => venue.id === contingency.indoorVenueId)?.name || contingency.indoorVenueId}
                </span>
              </li>
            ))}
          </ul>
        )}
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
          <button type="button" onClick={addRule} className="btn-primary px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm font-medium hover:bg-[#3b1435]" style={{ backgroundColor: config.primaryColor || '#4A1942' }}>
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
          guest portal), or automatically fetch a forecast by entering a location.
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
            className="btn-primary px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm font-medium hover:bg-[#3b1435] disabled:opacity-50"
            style={{ backgroundColor: config.primaryColor || '#4A1942' }}
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
              className="btn-primary px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm font-medium hover:bg-[#3b1435]"
              style={{ backgroundColor: config.primaryColor || '#4A1942' }}
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
    </div>
  );
}
