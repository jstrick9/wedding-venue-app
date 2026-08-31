import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #250 (campaign unit 1.3): pins the BrandingManagement.tsx defects
 * found when it left `@ts-nocheck`.
 *
 * F-250-5 (P1 runtime bug): same clone-stamp bug as F-250-1 — the props
 * destructure contained a nonexistent `FileReader` prop, shadowing the global
 * with `undefined`. Both `new FileReader()` calls in this file (the main logo
 * upload AND the drag-and-drop path, lines ~364/~844 pre-fix) threw
 * "FileReader is not a constructor" on every file pick. The branding panel IS
 * the upload surface, so its core flow was broken.
 */
describe('BrandingManagement typing fixes (Review #250)', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/admin/BrandingManagement.tsx'), 'utf8');
  const tabTypes = readFileSync(join(process.cwd(), 'src/components/admin/AdminTabTypes.ts'), 'utf8');

  it('no longer shadows browser globals via the props destructure (F-250-5)', () => {
    expect(source).not.toMatch(/^\s*FileReader,\s*$/m);
    expect(source).not.toMatch(/^\s*alert,\s*$/m);
    expect(source).not.toMatch(/^\s*window,\s*$/m);
    // Both upload paths still read files through the real global.
    expect(source.match(/new FileReader\(\)/g)?.length).toBe(2);
  });

  it('destructures a bounded set of props that all exist on the interface', () => {
    const destructure = source.match(/const\s*\{([\s\S]*?)\}\s*=\s*props/)?.[1] ?? '';
    const names = destructure
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      // `prop: alias` destructuring keeps the prop name on the left;
      // `prop = default` bindings keep the bare prop name.
      .map((n) => n.split(':')[0].split('=')[0].trim())
      .filter(Boolean);
    expect(names.length).toBeGreaterThan(0);
    expect(names.length).toBeLessThan(80);
    const interfaceBody = tabTypes.match(/export interface AdminCommonProps \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const fields = new Set(
      [...interfaceBody.matchAll(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\??:/gm)].map((m) => m[1]),
    );
    const missing = names.filter((n) => !fields.has(n));
    expect(missing).toEqual([]);
  });

  it('select controls write into Config literal unions, not raw strings', () => {
    expect(source).toContain("loginBackgroundType: e.target.value as Config['loginBackgroundType']");
    expect(source).toContain("loginBackgroundAnimation: e.target.value as Config['loginBackgroundAnimation']");
    expect(source).toContain("loginBackgroundPattern: e.target.value as Config['loginBackgroundPattern']");
  });
});
