/**
 * Detects dates that are simultaneously marked "Blocked / Unavailable" AND hold a
 * confirmed couple event — a contradiction the venue should resolve (e.g. remove
 * the blocked entry for a confirmed booking).
 */
export interface CalendarConflictItem {
  date: string; // YYYY-MM-DD
  category: string;
  /** Additional dates this item spans (e.g. multi-day couple events). */
  extraDates?: string[];
}

export function findBlockedBookedConflicts(items: CalendarConflictItem[]): string[] {
  const state: Record<string, { blocked: boolean; couple: boolean }> = {};
  const mark = (date: string | undefined, category: string) => {
    if (!date) return;
    state[date] = state[date] || { blocked: false, couple: false };
    if (category === 'blocked') state[date].blocked = true;
    if (category === 'couple') state[date].couple = true;
  };
  items.forEach((e) => {
    mark(e.date, e.category);
    (e.extraDates || []).forEach((d) => mark(d, e.category));
  });
  return Object.keys(state)
    .filter((d) => state[d].blocked && state[d].couple)
    .sort();
}
