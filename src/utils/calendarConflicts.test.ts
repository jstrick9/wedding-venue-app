import { describe, it, expect } from 'vitest';
import { findBlockedBookedConflicts } from './calendarConflicts';

describe('findBlockedBookedConflicts', () => {
  it('returns dates that are both blocked and hold a couple event', () => {
    const conflicts = findBlockedBookedConflicts([
      { date: '2026-09-01', category: 'blocked' },
      { date: '2026-09-01', category: 'couple' },
      { date: '2026-09-05', category: 'open-house' },
      { date: '2026-09-05', category: 'blocked' },
    ]);
    expect(conflicts).toEqual(['2026-09-01']);
  });

  it('returns empty when there are no contradictions', () => {
    expect(
      findBlockedBookedConflicts([
        { date: '2026-09-01', category: 'couple' },
        { date: '2026-09-02', category: 'blocked' },
      ]),
    ).toEqual([]);
  });

  it('sorts results chronologically', () => {
    expect(
      findBlockedBookedConflicts([
        { date: '2026-09-10', category: 'blocked' },
        { date: '2026-09-10', category: 'couple' },
        { date: '2026-09-01', category: 'blocked' },
        { date: '2026-09-01', category: 'couple' },
      ]),
    ).toEqual(['2026-09-01', '2026-09-10']);
  });

  it('ignores items without a date', () => {
    expect(findBlockedBookedConflicts([{ date: '', category: 'blocked' }, { date: '2026-09-01', category: 'couple' }])).toEqual([]);
  });
});
