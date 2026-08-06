import { describe, it, expect } from 'vitest';
import { formatDate, formatDateShort, formatDayDate, formatTime, dateFromDayKey } from './dateTime';

describe('dateTime helpers', () => {
  it('formats dates and returns empty for invalid input', () => {
    expect(formatDate('2026-09-10')).toMatch(/2026/);
    expect(formatDate(null)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });

  it('formats short date and weekday-date', () => {
    expect(formatDateShort('2026-09-10')).toMatch(/Sep/);
    expect(formatDayDate('2026-09-10')).toMatch(/Sep/);
    expect(formatDayDate('')).toBe('');
  });

  it('formats time', () => {
    expect(formatTime('2026-09-10T14:30:00')).toMatch(/2:30|14:30/);
    expect(formatTime(undefined)).toBe('');
  });

  it('builds a local date from a day key', () => {
    const d = dateFromDayKey('2026-09-10');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // September
    expect(d.getDate()).toBe(10);
  });
});
