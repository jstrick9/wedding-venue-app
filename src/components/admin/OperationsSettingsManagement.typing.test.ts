import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #255 (campaign unit 1.17): pins the OperationsSettingsManagement
 * defect found when it left `@ts-nocheck`.
 *
 * F-255-1 (P3 UX bug — fixed): the panel destructured `onShowSuccess` from
 * AdminCommonProps, but the prop is named `showSuccess` (AdminTabTypes.ts;
 * AdminPanel passes it via commonProps). `onShowSuccess` was always
 * undefined, so the optional-chained calls never fired: every mutating
 * action — add/remove checklist item, add/remove operational zone, reset
 * defaults — saved silently with no success toast since the panel was
 * created. All 5 sites now call `showSuccess`.
 */
describe('OperationsSettingsManagement typing fixes (Review #255)', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/admin/OperationsSettingsManagement.tsx'), 'utf8');

  it('calls the real showSuccess prop at all 5 action sites (F-255-1)', () => {
    expect(source.match(/showSuccess\('/g)?.length).toBe(5);
    // the phantom prop name is gone entirely (destructure and calls)
    expect(source).not.toMatch(/onShowSuccess/);
    // and the prop is destructured
    expect(source).toMatch(/^ {2}const \{ config, showSuccess \} = props;$/m);
  });
});
