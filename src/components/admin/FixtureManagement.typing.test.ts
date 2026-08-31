import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #251 (campaign unit 1.4): pins the FixtureManagement.tsx defects
 * found when it left `@ts-nocheck`.
 *
 * F-251-1 (type-model gap — fixed): fixture data has carried a `description`
 * field since inception (defaultFixtureTypes: "17' 11\" opening" etc.) but
 * `FixtureType` never declared it, so the fixture search filter's
 * `f.description` branch was type-invisible.
 *
 * F-251-2 (P1 functional bug — fixed): the venue-category toggle computed the
 * next `venueCategories` array and then saved the fixtures UNCHANGED
 * (`{ ...f }`), discarding the computed value. The category chips on fixtures
 * never did anything. tsc's unused-locals check would have caught this the
 * day it was written had the file not been @ts-nocheck.
 */
describe('FixtureManagement typing fixes (Review #251)', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/admin/FixtureManagement.tsx'), 'utf8');
  const types = readFileSync(join(process.cwd(), 'src/types.ts'), 'utf8');

  it('FixtureType declares the description field the data already carries (F-251-1)', () => {
    const fixtureType = types.match(/export interface FixtureType \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(fixtureType).toMatch(/^\s*description\?: string;/m);
    // And the search filter still reads it.
    expect(source).toContain('(f.description || \'\')');
  });

  it('the venue-category toggle APPLIES the computed value (F-251-2)', () => {
    // The save must apply venueCategories to the edited fixture…
    expect(source).toContain('{ ...f, venueCategories }');
    // …and the discard pattern that shipped for the feature's whole life is gone.
    expect(source).not.toMatch(
      /const venueCategories = selected[\s\S]{0,120}\{ \.\.\.f \} : f\)\);/,
    );
  });

  it('no global shadowing via the props destructure', () => {
    expect(source).not.toMatch(/^\s*FileReader,\s*$/m);
    expect(source).not.toMatch(/^\s*alert,\s*$/m);
  });
});
