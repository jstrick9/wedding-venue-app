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
