import { describe, it, expect } from 'vitest';
import { groupByPhase } from './groupByPhase';

describe('groupByPhase', () => {
  it('groups items by their phase in first-appearance order', () => {
    const grouped = groupByPhase([
      { id: '1', title: 'A', phase: 'Planning' },
      { id: '2', title: 'B', phase: 'Day-of' },
      { id: '3', title: 'C', phase: 'Planning' },
    ]);
    expect(grouped.map((g) => g.phase)).toEqual(['Planning', 'Day-of']);
    expect(grouped[0].items.map((i) => i.id)).toEqual(['1', '3']);
    expect(grouped[1].items.map((i) => i.id)).toEqual(['2']);
  });

  it('groups items without a phase into General', () => {
    const grouped = groupByPhase([
      { id: '1', title: 'A' },
      { id: '2', title: 'B', phase: 'Setup' },
    ]);
    expect(grouped.map((g) => g.phase)).toEqual(['General', 'Setup']);
  });

  it('trims and collapses whitespace-only phases into General', () => {
    const grouped = groupByPhase([
      { id: '1', title: 'A', phase: '  ' },
      { id: '2', title: 'B', phase: 'Planning' },
    ]);
    expect(grouped.map((g) => g.phase)).toEqual(['General', 'Planning']);
  });

  it('returns empty for empty input', () => {
    expect(groupByPhase([])).toEqual([]);
  });
});
