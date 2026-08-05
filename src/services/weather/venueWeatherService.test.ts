import { describe, it, expect, beforeEach } from 'vitest';
import {
  getVenueWeather,
  setDayWeather,
  removeDayWeather,
  getDayWeather,
  eventDates,
} from './venueWeatherService';

describe('venueWeatherService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to an empty forecast config', () => {
    expect(getVenueWeather().forecasts).toEqual({});
  });

  it('sets and reads a forecast for a date', () => {
    setDayWeather('2026-06-06', { condition: 'Sunny', tempHigh: 78, rainChance: 10 });
    expect(getDayWeather('2026-06-06')).toMatchObject({ condition: 'Sunny', tempHigh: 78 });
    expect(getDayWeather('2026-06-07')).toBeUndefined();
  });

  it('removes a forecast for a date', () => {
    setDayWeather('2026-06-06', { condition: 'Rain' });
    removeDayWeather('2026-06-06');
    expect(getDayWeather('2026-06-06')).toBeUndefined();
  });

  it('builds inclusive date spans across a multi-day event', () => {
    const dates = eventDates('2026-06-05', '2026-06-07');
    expect(dates).toEqual(['2026-06-05', '2026-06-06', '2026-06-07']);
  });

  it('returns a single day when no end date', () => {
    expect(eventDates('2026-06-05')).toEqual(['2026-06-05']);
  });
});
