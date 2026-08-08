import { describe, it, expect } from 'vitest';
import { formatDate, formatDateShort, formatDayDate, formatTime, dateFromDayKey, toLocalDatetimeInput, fromLocalDatetimeInput } from './dateTime';

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

  it('converts to/from datetime-local input string without timezone shift', () => {
    const date = new Date(2026, 7, 8, 14, 30); // 2026-08-08 14:30 local time
    const input = toLocalDatetimeInput(date);
    expect(input).toBe('2026-08-08T14:30');

    const iso = fromLocalDatetimeInput('2026-08-08T14:30');
    expect(new Date(iso).getHours()).toBe(14);
    expect(new Date(iso).getMinutes()).toBe(30);

    expect(toLocalDatetimeInput(null)).toBe('');
    expect(fromLocalDatetimeInput('')).toBe('');
  });
});
