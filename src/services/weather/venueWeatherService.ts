import { VenueWeatherConfig, DayWeatherForecast } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { STORAGE_VERSIONS } from '../../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../../utils/storage';

const KEY = STORAGE_KEYS.VENUE_WEATHER;
const VERSION = STORAGE_VERSIONS.VENUE_WEATHER;

export function getVenueWeather(): VenueWeatherConfig {
  return loadVersionedStorage<VenueWeatherConfig>({
    key: KEY,
    defaultValue: { forecasts: {}, updatedAt: new Date().toISOString() },
    currentVersion: VERSION,
    validate: (v): v is VenueWeatherConfig => !!v && typeof v === 'object',
    normalize: (v) => (v ? (v as VenueWeatherConfig) : { forecasts: {}, updatedAt: new Date().toISOString() }),
  });
}

export function saveVenueWeather(config: VenueWeatherConfig): void {
  saveVersionedStorage(KEY, VERSION, config);
}

/** Set a forecast for a specific date. */
export function setDayWeather(date: string, forecast: DayWeatherForecast): void {
  const cfg = getVenueWeather();
  saveVenueWeather({
    ...cfg,
    forecasts: { ...cfg.forecasts, [date]: forecast },
    updatedAt: new Date().toISOString(),
  });
}

export function removeDayWeather(date: string): void {
  const cfg = getVenueWeather();
  const next = { ...cfg.forecasts };
  delete next[date];
  saveVenueWeather({ ...cfg, forecasts: next, updatedAt: new Date().toISOString() });
}

export function getDayWeather(date: string): DayWeatherForecast | undefined {
  return getVenueWeather().forecasts[date];
}

/** Build the set of dates across an event span (inclusive). */
export function eventDates(eventStart?: string, eventEnd?: string): string[] {
  if (!eventStart) return [];
  const start = new Date(eventStart);
  const end = eventEnd ? new Date(eventEnd) : start;
  if (isNaN(start.getTime())) return [];
  const out: string[] = [];
  const cursor = new Date(start);
  const endT = isNaN(end.getTime()) || end < start ? start : end;
  let guard = 0;
  while (cursor <= endT && guard < 14) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return out;
}

// ── Optional free-tier weather API hook ─────────────────────────────────────
// Pulls a real forecast from the Open-Meteo API (no key required). Used only when
// a location is set; if the request fails, the manual forecasts remain authoritative.
export async function fetchWeatherForecast(location: string): Promise<Record<string, DayWeatherForecast>> {
  try {
    // Resolve lat/lng from the location string via the Open-Meteo geocoder.
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`,
    );
    if (!geo.ok) return {};
    const geoJson = await geo.json();
    const place = geoJson?.results?.[0];
    if (!place) return {};

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}` +
      `&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&forecast_days=7&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = await res.json();

    const out: Record<string, DayWeatherForecast> = {};
    const codeToCondition = (code: number): string => {
      if (code === 0) return 'Sunny';
      if (code <= 3) return 'Partly Cloudy';
      if (code <= 48) return 'Foggy';
      if (code <= 67) return 'Rain';
      if (code <= 77) return 'Snow';
      if (code <= 86) return 'Snow Showers';
      return 'Thunderstorms';
    };
    (data.daily?.time || []).forEach((t: string, i: number) => {
      out[t] = {
        condition: codeToCondition(data.daily.weather_code?.[i] ?? 0),
        tempHigh: data.daily.temperature_2m_max?.[i],
        tempLow: data.daily.temperature_2m_min?.[i],
        rainChance: data.daily.precipitation_probability_max?.[i],
      };
    });
    return out;
  } catch {
    return {};
  }
}
