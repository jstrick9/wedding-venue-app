import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #251 (campaign unit 1.7): pins the VenueDashboard.tsx defects found
 * when it left `@ts-nocheck`.
 *
 * F-251-6 (P2 runtime bug — fixed): `onClick={props.onOpenAdmin}` passed the
 * MouseEvent straight into `(tab?: string) => void`, so the parent built the
 * URL hash `#/admin/[object PointerEvent]` and emitted a garbage
 * `spm_open_admin_tab` event on every click of the quick-action button.
 *
 * F-251-5 / F-251-7 (type-model lies — fixed): the sidebar item type omitted
 * `badgeCount` (forcing `(item as any).badgeCount` casts downstream), and the
 * `user`/`users` props were loose partials/`any[]` while the parent passes
 * real `User` objects.
 */
describe('VenueDashboard typing fixes (Review #251)', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/VenueDashboard.tsx'), 'utf8');

  it('admin quick-action passes no argument instead of the MouseEvent (F-251-6)', () => {
    expect(source).toContain('onClick={() => props.onOpenAdmin()}');
    expect(source).not.toMatch(/onClick=\{props\.onOpenAdmin\}/);
  });

  it('sidebar items declare badgeCount — no more as-any casts (F-251-5)', () => {
    expect(source).toMatch(/action: \(\) => void; badgeCount\?: number \}\[\]/);
    expect(source).not.toContain('(item as any).badgeCount');
    expect(source).toContain('item.badgeCount');
  });

  it('user props are honestly typed (F-251-7)', () => {
    expect(source).toMatch(/^\s{2}user: User;$/m);
    expect(source).toMatch(/^\s{2}users\?: User\[\];$/m);
    expect(source).not.toMatch(/users\?: any\[\]/);
  });
});
