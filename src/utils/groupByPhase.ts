/**
 * Groups checklist-style items by their (free-form) phase label. Items without a
 * phase fall into a "General" group. Groups are returned in first-appearance
 * order so the phase the user typed first shows first.
 */
export interface PhaseGroupable {
  phase?: string;
}

export function groupByPhase<T extends PhaseGroupable>(
  items: T[],
  defaultLabel = 'General',
): { phase: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = item.phase?.trim() || defaultLabel;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  return Array.from(groups.entries()).map(([phase, groupItems]) => ({
    phase,
    items: groupItems,
  }));
}
