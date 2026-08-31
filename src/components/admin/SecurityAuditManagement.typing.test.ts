import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #256 (campaign unit 1.18): pins the SecurityAuditManagement
 * defect found when it left `@ts-nocheck`.
 *
 * F-256-1 (P3 UX bug — fixed, same family as F-255-1): the panel
 * destructured `onShowSuccess` from AdminCommonProps, but the prop is
 * named `showSuccess` (passed via commonProps). Always undefined, so 5
 * success toasts never fired since creation: save security settings,
 * clear cache (2 variants), export audit log as CSV, export as JSON.
 * The component's own test fixture mocked the phantom name — codifying
 * the bug — and was upgraded to the real name alongside the fix.
 */
describe('SecurityAuditManagement typing fixes (Review #256)', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/admin/SecurityAuditManagement.tsx'), 'utf8');

  it('calls the real showSuccess prop at all 5 action sites (F-256-1)', () => {
    expect(source.match(/showSuccess\('/g)?.length).toBe(5);
    expect(source).not.toMatch(/onShowSuccess/);
    expect(source).toMatch(/^ {2}const \{ config, showSuccess \} = props;$/m);
  });
});
