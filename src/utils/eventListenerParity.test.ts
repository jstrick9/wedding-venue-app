import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard against losing the event-bus → modal wiring.
 *
 * The Header/Sidebar/PropertiesPanel open modals by emitting `spm_open_*`
 * events (e.g. spm_open_vendors, spm_open_timeline, spm_open_decor_designer,
 * spm_open_workspace_help). When these events are emitted but no component
 * listens (previously the useAppModals hook handled them; it was removed and
 * the buttons silently broke), the feature is dead. This statically checks that
 * every `emit('spm_open_*')` in the codebase has a matching `on('spm_open_*')`
 * in AuthenticatedApp (or another component).
 */
const SRC = resolve(__dirname, '..');

describe('event-bus open-* listener parity', () => {
  it('every emitted spm_open_* event has a listener', () => {
    const emitPattern = /emit\('(spm_open_[a-z_]+)'/g;
    const emitted = new Set<string>();

    const walk = (dir: string): string[] => {
      const { readdirSync, statSync } = require('node:fs');
      const { join } = require('node:path');
      const out: string[] = [];
      for (const ent of readdirSync(dir)) {
        if (ent.startsWith('node_modules') || ent === '.git' || ent === 'dist') continue;
        const p = join(dir, ent);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (/\.(ts|tsx)$/.test(ent) && !ent.endsWith('.test.ts') && !ent.endsWith('.test.tsx')) out.push(p);
      }
      return out;
    };

    for (const file of walk(SRC)) {
      const src = readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = emitPattern.exec(src)) !== null) emitted.add(m[1]);
    }

    // Collect all on('spm_open_*') listeners across the codebase.
    const onPattern = /on\('(spm_open_[a-z_]+)'/g;
    const listened = new Set<string>();
    for (const file of walk(SRC)) {
      const src = readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = onPattern.exec(src)) !== null) listened.add(m[1]);
    }

    const missing = Array.from(emitted).filter((e) => !listened.has(e));
    expect(missing).toEqual([]);
    // Sanity: at least these are wired.
    expect(listened.has('spm_open_vendors')).toBe(true);
    expect(listened.has('spm_open_timeline')).toBe(true);
    expect(listened.has('spm_open_decor_designer')).toBe(true);
  });
});
