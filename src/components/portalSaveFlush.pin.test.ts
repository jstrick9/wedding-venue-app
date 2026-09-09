import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #264 (Phase 4 batch 2 — stores/race & timer-cleanup sweep): pins the
 * debounced-save flush fix.
 *
 * F-264-1 (P4 dropped save): the CouplesPortal cloud-sync effect debounced
 * snapshot pushes by 350ms after `spm_data_changed`. Its cleanup cleared
 * `cloudSaveTimerRef` WITHOUT firing the pending push, so a couple who made an
 * edit and closed/navigated away from the portal inside the debounce window
 * never uploaded that edit — the cloud kept a stale snapshot until a later
 * session happened to change data again. The cleanup now flushes the pending
 * save (safe during teardown: `pushLocalSnapshot` does not setState) instead
 * of silently dropping it.
 */
describe('CouplesPortal flushes a pending debounced cloud save on unmount (F-264-1)', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/CouplesPortal.tsx'), 'utf8');

  it('cleanup flushes the pending save instead of only clearing the timer', () => {
    const cleanup = /return \(\) => \{[\s\S]*?\}, \[cloudAccountInvite, cloudToken, event\?\.id, portalAccountAccess, session\?\.eventId,[^\]]*venueSlug\]\);/.exec(src)?.[0] ?? '';
    expect(cleanup).not.toBe('');
    // The timer clear and the flush must live inside the same cleanup block.
    expect(cleanup).toMatch(/if \(cloudSaveTimerRef\.current\) \{\s*clearTimeout\(cloudSaveTimerRef\.current\);\s*void pushLocalSnapshot\(\);/);
  });

  it('flush is guarded to run only when a save was actually pending', () => {
    // Dropping the `if` would push a redundant snapshot on every teardown;
    // the guard keeps unmount-with-no-pending-edits a no-op.
    const src2 = src;
    expect(src2).not.toMatch(/clearTimeout\(cloudSaveTimerRef\.current\);\s*\}\s*void pushLocalSnapshot\(\);/);
    expect(src2).toMatch(/cloudSaveTimerRef\.current = null;/);
  });
});
