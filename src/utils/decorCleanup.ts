/**
 * Data-integrity helper for decor arrangements.
 *
 * When a decor arrangement is deleted, any placed table/fixture that still has
 * `appliedArrangementId` pointing at it keeps a stale reference (a "Design
 * Active" badge that no longer resolves, and a broken "Edit Design" link). This
 * scrubs those references so the layout stays consistent with the arrangement
 * catalog.
 */

export interface AppliedDecorItem {
  id: string;
  appliedArrangementId?: string;
}

export function scrubArrangementRefs<T extends AppliedDecorItem>(
  items: T[],
  validIds: Set<string>,
): T[] {
  return items.map((item) =>
    item.appliedArrangementId && !validIds.has(item.appliedArrangementId)
      ? { ...item, appliedArrangementId: undefined }
      : item,
  );
}
