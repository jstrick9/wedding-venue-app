import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCoupleSetupTasks,
  addCoupleSetupTask,
  updateCoupleSetupTask,
  removeCoupleSetupTask,
  getCoupleSetupTasksForBackup,
  removeCoupleSetupTasks,
} from './coupleSetupService';

describe('coupleSetupService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds and scopes setup tasks per couple event', () => {
    addCoupleSetupTask('e1', { title: 'Move tables', spaceId: 'reception', dayIndex: 1 });
    addCoupleSetupTask('e2', { title: 'Other', spaceId: 'ceremony' });
    expect(getCoupleSetupTasks('e1')).toHaveLength(1);
    expect(getCoupleSetupTasks('e2')).toHaveLength(1);
  });

  it('sorts tasks by scheduled time', () => {
    addCoupleSetupTask('e1', { title: 'Late', scheduledFor: '2026-08-09T10:00' });
    addCoupleSetupTask('e1', { title: 'Early', scheduledFor: '2026-08-08T08:00' });
    addCoupleSetupTask('e1', { title: 'None' });
    const tasks = getCoupleSetupTasks('e1');
    expect(tasks.map((t) => t.title)).toEqual(['None', 'Early', 'Late']);
  });

  it('updates status/assignee and removes tasks', () => {
    const t = addCoupleSetupTask('e1', { title: 'Install decor', assignee: 'Alex' })!;
    updateCoupleSetupTask('e1', t.id, { status: 'in-progress', assignee: 'Taylor' });
    const stored = getCoupleSetupTasks('e1')[0];
    expect(stored.status).toBe('in-progress');
    expect(stored.assignee).toBe('Taylor');
    removeCoupleSetupTask('e1', t.id);
    expect(getCoupleSetupTasks('e1')).toHaveLength(0);
  });

  it('removes all tasks for a couple on cleanup and backs up all', () => {
    addCoupleSetupTask('e1', { title: 'A' });
    addCoupleSetupTask('e1', { title: 'B' });
    addCoupleSetupTask('e2', { title: 'C' });
    expect(getCoupleSetupTasksForBackup()).toHaveLength(3);
    removeCoupleSetupTasks('e1');
    expect(getCoupleSetupTasks('e1')).toHaveLength(0);
    expect(getCoupleSetupTasks('e2')).toHaveLength(1);
  });
});
