/** Shared, safe date/time formatting helpers for consistent output across the platform. */

/** Format a date-ish value as a locale date string; returns '' for invalid input. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

/** Short date (e.g. "Aug 7") for calendars/lists. */
export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Weekday + short date (e.g. "Fri, Aug 7"). */
export function formatDayDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** HH:mm time from an ISO/date value; returns '' for invalid input. */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Normalize a YYYY-MM-DD to a Date at local midnight (avoids TZ off-by-one). */
export function dateFromDayKey(value: string): Date {
  return new Date(value + 'T00:00:00');
}

/**
 * Convert an ISO timestamp or date string to a "YYYY-MM-DDTHH:mm" local string
 * suitable for `<input type="datetime-local">` without timezone offset shift.
 */
export function toLocalDatetimeInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Parse a local "YYYY-MM-DDTHH:mm" datetime-local input string into a valid ISO string.
 */
export function fromLocalDatetimeInput(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}
