#!/usr/bin/env node
/**
 * `@ts-nocheck` ratchet (Review #247, P2-I remediation).
 *
 * Why
 * ---
 * 24 runtime files (the entire venue-admin console, ~18.6 K lines) suppress
 * TypeScript checking with `// @ts-nocheck`, so the green `tsc` gate covers
 * none of the surface that writes org_data. Retyping them all is a long
 * campaign; what must NOT happen is the count silently growing. This ratchet
 * fails CI when the count exceeds the current maximum. Lower the number as
 * files get retyped — never raise it without a review note.
 *
 * Usage
 *   node scripts/check-ts-nocheck-ratchet.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Maximum allowed runtime (non-test) files under src/ containing
 * `@ts-nocheck`. Baseline 24 at #247; 21 at #249; 20 at #250 (unit 1.2); 19 at #250 (unit 1.3); 18 at #251 (unit 1.4); 17 at #251 (unit 1.5); 16 at #251 (unit 1.6); 15 at #251 (unit 1.7); 12 at #252 (units 1.8 ChairManagement, 1.9 WallManagement, 1.10 SpacingManagement); 9 at #253 (units 1.11 TemplateManagement, 1.12 LinenManagement, 1.13 VenueCalendar); 7 at #254 (units 1.14 GuidelineManagement, 1.15 AccessControlPanel).
 */
export const MAX_TS_NOCHECK_FILES = 7;

/** Pure evaluator: given the list of offending file paths, decide pass/fail. */
export function evaluateRatchet(files, max = MAX_TS_NOCHECK_FILES) {
  const failures = [];
  if (files.length > max) {
    failures.push(
      `${files.length} runtime files use @ts-nocheck (ratchet ceiling: ${max}). ` +
        'New files must be fully typed — remove @ts-nocheck or type the file.',
    );
  }
  return {
    ok: failures.length === 0,
    failures,
    count: files.length,
    max,
    files,
  };
}

function listTsNocheckFiles(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !/\.(test|spec)\.[jt]sx?$/.test(entry.name)
      ) {
        const content = readFileSync(full, 'utf8');
        if (content.includes('@ts-nocheck')) {
          found.push(full.slice(root.length + 1));
        }
      }
    }
  };
  walk(root);
  return found.sort();
}

function run() {
  const src = join(process.cwd(), 'src');
  const files = listTsNocheckFiles(src);
  const result = evaluateRatchet(files);
  console.log(`@ts-nocheck runtime files: ${result.count} (ceiling ${result.max})`);
  if (result.count > 0) {
    console.log('Files still carrying the suppression:');
    result.files.forEach((file) => console.log(`  ${file}`));
  }
  if (!result.ok) {
    result.failures.forEach((line) => console.error(`TS-NOCHECK RATCHET EXCEEDED: ${line}`));
    process.exit(1);
  }
  console.log('Within ratchet ceiling.');
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('check-ts-nocheck-ratchet.mjs') ||
    process.argv[1].endsWith('check-ts-nocheck-ratchet'));
if (isDirectRun) {
  run();
}
