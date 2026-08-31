import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #250 (campaign unit 1.2): pins the defects found when
 * UserManagement.tsx left `@ts-nocheck`.
 *
 * - F-250-1: the props destructure contained `FileReader` (and `alert`),
 *   shadowing the browser globals with `undefined` — `new FileReader()` in
 *   the profile-image upload threw "FileReader is not a constructor" the
 *   moment a file was picked. Paste garbage from another component's scope.
 * - F-250-2: two showInfo() calls passed only a message where the API is
 *   (title, message, kind?) — the dialog rendered an undefined body.
 * - The 267-name destructure shrank to the names actually used; the props
 *   model gained a real NewUserDraft type.
 */
describe('UserManagement typing fixes (Review #250)', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/admin/UserManagement.tsx'), 'utf8');
  const tabTypes = readFileSync(join(process.cwd(), 'src/components/admin/AdminTabTypes.ts'), 'utf8');

  it('no longer shadows browser globals via the props destructure (F-250-1)', () => {
    // Destructure lines are bare identifiers + comma; a match here means the
    // global is being shadowed by an (undefined) prop again.
    expect(source).not.toMatch(/^\s*FileReader,\s*$/m);
    expect(source).not.toMatch(/^\s*alert,\s*$/m);
    expect(source).not.toMatch(/^\s*window,\s*$/m);
    // The profile-image upload still reads files through the real global.
    expect(source).toContain('new FileReader()');
  });

  it('showInfo calls pass title and message (F-250-2)', () => {
    expect(source).toContain("showInfo('Link Copied', 'Copied Couples Portal link to clipboard.')");
    expect(source).toContain("showInfo('Email Invite', `Opening email draft for ${couple.coupleName}.`)");
    // No single-string-argument showInfo calls remain.
    expect(source).not.toMatch(/showInfo\(\s*'[^']*'\s*\)/);
    expect(source).not.toMatch(/showInfo\(\s*`[^`]*`\s*\)/);
  });

  it('the create-user draft is a real type, not Record<string, unknown>', () => {
    expect(tabTypes).toContain('export interface NewUserDraft {');
    expect(tabTypes).toMatch(/newUser: NewUserDraft;/);
    expect(tabTypes).not.toMatch(/newUser: Record<string, unknown>/);
  });

  it('destructures a bounded set of props, not the whole admin universe', () => {
    const destructure = source.match(/const\s*\{([\s\S]*?)\}\s*=\s*props/)?.[1] ?? '';
    const names = destructure.split(',').map((n) => n.trim()).filter(Boolean);
    expect(names.length).toBeGreaterThan(0);
    // 267 names were destructured before the prune (57 of them not even on
    // the props interface). The used set is an order of magnitude smaller.
    expect(names.length).toBeLessThan(80);
    // And every destructured name exists on the props interface.
    const interfaceBody = tabTypes.match(/export interface AdminCommonProps \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const fields = new Set(
      [...interfaceBody.matchAll(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\??:/gm)].map((m) => m[1]),
    );
    const missing = names.filter((n) => !fields.has(n));
    expect(missing).toEqual([]);
  });
});
