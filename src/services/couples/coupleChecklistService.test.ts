import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCoupleChecklist,
  addCoupleChecklistItem,
  updateCoupleChecklistItem,
  toggleCoupleChecklistItem,
  removeCoupleChecklistItem,
  getCoupleChecklistsForBackup,
  removeCoupleChecklists,
} from './coupleChecklistService';

describe('coupleChecklistService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds and scopes checklist items per couple event', () => {
    addCoupleChecklistItem('e1', { title: 'Confirm menu' });
    addCoupleChecklistItem('e1', { title: 'Order flowers', phase: 'Planning' });
    addCoupleChecklistItem('e2', { title: 'Other' });
    expect(getCoupleChecklist('e1')).toHaveLength(2);
    expect(getCoupleChecklist('e2')).toHaveLength(1);
  });

  it('toggles, updates, and removes items', () => {
    const item = addCoupleChecklistItem('e1', { title: 'Task' })!;
    toggleCoupleChecklistItem('e1', item.id);
    expect(getCoupleChecklist('e1')[0].done).toBe(true);
    updateCoupleChecklistItem('e1', item.id, { phase: 'Setup' });
    expect(getCoupleChecklist('e1')[0].phase).toBe('Setup');
    removeCoupleChecklistItem('e1', item.id);
    expect(getCoupleChecklist('e1')).toHaveLength(0);
  });

  it('rejects empty titles and backs up all items', () => {
    expect(addCoupleChecklistItem('e1', { title: '   ' })).toBeNull();
    addCoupleChecklistItem('e1', { title: 'A' });
    expect(getCoupleChecklistsForBackup()).toHaveLength(1);
  });

  it('removes all items for a couple on cleanup', () => {
    addCoupleChecklistItem('e1', { title: 'A' });
    addCoupleChecklistItem('e1', { title: 'B' });
    addCoupleChecklistItem('e2', { title: 'C' });
    removeCoupleChecklists('e1');
    expect(getCoupleChecklist('e1')).toHaveLength(0);
    expect(getCoupleChecklist('e2')).toHaveLength(1);
  });
});
