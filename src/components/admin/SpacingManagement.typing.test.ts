import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #252 (campaign unit 1.10): pins the SpacingManagement.tsx defect
 * found when it left `@ts-nocheck`.
 *
 * F-252-1 (P1 runtime bug — fixed): every control in the Spacing panel called
 * `setSpacingSettings(updated)` — a name that exists only in AdminPanel's
 * scope (its service-layer import), never destructured here. Every onChange
 * threw `ReferenceError: setSpacingSettings is not defined`, so the state
 * update, the success toast, and persistence never ran: the entire panel —
 * collision detection, warnings, and all spacing inputs — has been
 * non-functional since creation. The intended call was the
 * `handleSaveSpacing` prop (persist + state), which AdminPanel passes in
 * commonProps. All 12 sites now call it.
 */
describe('SpacingManagement typing fixes (Review #252)', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/admin/SpacingManagement.tsx'), 'utf8');

  it('calls the handleSaveSpacing prop, not AdminPanel-internal names (F-252-1)', () => {
    // The prop call is present at every save site…
    expect(source.match(/handleSaveSpacing\(updated\);/g)?.length).toBe(12);
    // …the undefined call is gone (comment mentions don't count)…
    expect(source).not.toMatch(/^\s*setSpacingSettings\(/m);
    // …and the prop is destructured.
    expect(source).toMatch(/^\s+handleSaveSpacing,$/m);
  });

  it('no global shadowing via the props destructure', () => {
    expect(source).not.toMatch(/^\s*FileReader,\s*$/m);
    expect(source).not.toMatch(/^\s*alert,\s*$/m);
  });
});
