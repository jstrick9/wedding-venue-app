import { describe, it, expect } from 'vitest';
import { scrubArrangementRefs } from './decorCleanup';

describe('scrubArrangementRefs (decor data-integrity)', () => {
  it('clears appliedArrangementId for references no longer in the catalog', () => {
    const valid = new Set(['a1', 'a2']);
    const tables = [
      { id: 't1', appliedArrangementId: 'a1' },
      { id: 't2', appliedArrangementId: 'deleted-a' },
      { id: 't3', appliedArrangementId: 'a2' },
    ];
    const next = scrubArrangementRefs(tables, valid);
    expect(next[0].appliedArrangementId).toBe('a1'); // kept
    expect(next[1].appliedArrangementId).toBeUndefined(); // scrubbed
    expect(next[2].appliedArrangementId).toBe('a2'); // kept
    // Non-mutating.
    expect(tables[1].appliedArrangementId).toBe('deleted-a');
  });

  it('leaves items without an applied arrangement untouched', () => {
    const items = [{ id: 'f1' }, { id: 'f2', appliedArrangementId: undefined }];
    const next = scrubArrangementRefs(items, new Set());
    expect(next).toEqual(items);
  });
});
