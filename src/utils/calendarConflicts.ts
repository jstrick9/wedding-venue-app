/**
 * Detects dates that are simultaneously marked "Blocked / Unavailable" AND hold a
 * confirmed couple event — a contradiction the venue should resolve (e.g. remove
 * the blocked entry for a confirmed booking).
 */
export interface CalendarConflictItem {
  date: string; // YYYY-MM-DD
  category: string;
}

export function findBlockedBookedConflicts(items: CalendarConflictItem[]): string[] {
  const state: Record<string, { blocked: boolean; couple: boolean }> = {};
  items.forEach((e) => {
    if (!e.date) return;
    state[e.date] = state[e.date] || { blocked: false, couple: false };
    if (e.category === 'blocked') state[e.date].blocked = true;
    if (e.category === 'couple') state[e.date].couple = true;
  });
  return Object.keys(state)
    .filter((d) => state[d].blocked && state[d].couple)
    .sort();
}
