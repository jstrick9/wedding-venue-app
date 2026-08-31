import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #251 (campaign unit 1.6): pins the TableManagement.tsx defects found
 * when it left `@ts-nocheck`.
 *
 * F-251-4 (P1 functional bug — fixed): the "Venue Category Availability"
 * chips on tables had the SAME discard bug as F-251-2 in FixtureManagement —
 * the onClick computed the next `venueCategories` array and then saved the
 * tables list UNCHANGED (`{ ...t }`), so the chips never did anything. The UI
 * literally instructs "Choose which venue categories can use this table."
 * Full blast radius of the clone: exactly these two files (scanned).
 */
describe('TableManagement typing fixes (Review #251)', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/admin/TableManagement.tsx'), 'utf8');

  it('the venue-category toggle APPLIES the computed value (F-251-4)', () => {
    expect(source).toContain('{ ...t, venueCategories }');
    expect(source).not.toMatch(
      /const venueCategories = selected[\s\S]{0,140}\{ \.\.\.t \} : t\)\);/,
    );
  });

  it('no global shadowing via the props destructure', () => {
    expect(source).not.toMatch(/^\s*FileReader,\s*$/m);
    expect(source).not.toMatch(/^\s*alert,\s*$/m);
  });
});
