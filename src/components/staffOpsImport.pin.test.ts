import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #266 (Phase 4 batch 4 — StaffOperationsPanel deep-flow audit): pins
 * the operations export/import hardening.
 *
 * - F-266-1 (P4): the JSON import staged `data.tasks`/`areas`/`shifts` without
 *   shape validation. A truthy non-array value flowed into
 *   `[...pendingImport.tasks, ...tasks]` on confirm — strings spread
 *   char-by-char (corrupting the task list with garbage entries) and objects
 *   throw a TypeError (crashing the confirm handler). Imports are now coerced
 *   through an Array.isArray guard and rejected with a toast when empty.
 * - F-266-2 (P5): the file input was never reset, so re-picking the SAME file
 *   fired no onChange and silently did nothing.
 * - F-266-3 (P5): the export blob object URL was never revoked, leaking the
 *   URL and blob for the session on every export.
 */
describe('StaffOperationsPanel export/import hardening (F-266-1/2/3)', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/StaffOperationsPanel.tsx'), 'utf8');

  it('import validates array shapes before staging (no crash/corruption on confirm)', () => {
    expect(src).toMatch(/const\s+asArray\s*=\s*\(v:\s*unknown\):\s*any\[\]\s*=>\s*\(Array\.isArray\(v\)\s*\?\s*v\s*:\s*\[\]\);/);
    expect(src).toMatch(/if\s*\(!tasks\.length\s*&&\s*!areas\.length\s*&&\s*!shifts\.length\)\s*\{\s*showToast\('No operations tasks, areas, or shifts found in that file\.',\s*'warning'\);/);
  });

  it('file input resets after selection so the same file can be re-imported', () => {
    expect(src).toMatch(/e\.target\.value = '';/);
  });

  it('export revokes its blob object URL after initiating the download', () => {
    const handleExport = /const handleExport = \(\) => \{[\s\S]*?\n\s{4}\};/.exec(src)?.[0] ?? '';
    expect(handleExport).not.toBe('');
    expect(handleExport).toMatch(/URL\.revokeObjectURL\(url\);/);
  });
});
