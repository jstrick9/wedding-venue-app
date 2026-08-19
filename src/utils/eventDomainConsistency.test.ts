import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BACKUP_DOMAINS } from './backupDomains';
import { storageKeyToDomainKey } from './storage';

/**
 * Guards against the P1-3 class of bug: `emitDataChanged` (and the versioned
 * storage layer) must only emit domain names that the backend entity repository
 * can resolve to a real persistence domain. If someone introduces a new domain
 * without registering it (or emits a typo'd string), this test fails.
 *
 * The set of emitted literals is scraped from the source tree, so it covers all
 * present and future call sites without a manual list.
 */
function collectEmitLiterals(dir: string, results: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      collectEmitLiterals(full, results);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      const src = readFileSync(full, 'utf8');
      const matches = [...src.matchAll(/emitDataChanged\(\s*'([^']+)'\s*\)/g)];
      for (const m of matches) results.push(m[1]);
    }
  }
  return results;
}

const registryKeys = new Set<string>(BACKUP_DOMAINS.map((d) => d.key));
const registryStorageKeys = new Set<string>(BACKUP_DOMAINS.map((d) => d.storageKey));

describe('event domain consistency (P1-3 regression guard)', () => {
  const emitted = collectEmitLiterals('src');

  it('sees at least the known domains', () => {
    expect(emitted.length).toBeGreaterThan(10);
  });

  it('every emitted domain resolves to a registered persistence domain or a control value', () => {
    const control = new Set(['all', 'backend_hydrated']);
    const problems = emitted.filter(
      (value) =>
        !control.has(value) &&
        !registryKeys.has(value) &&
        !registryStorageKeys.has(value) &&
        // Storage-key-prefixed keys emitted by legacy call sites resolve via the registry.
        storageKeyToDomainKey(value) === 'all',
    );
    expect([...new Set(problems)]).toEqual([]);
  });

  it('canonical domain events map to the exact registry key (no aliasing)', () => {
    // The previously-mismatched domains must now be emitted as canonical keys.
    const canonicalExpectation: Record<string, string> = {
      chairSpecs: 'chairSpecs',
      spacingSettings: 'spacingSettings',
      venueMapConfigs: 'venueMapConfigs',
      coupleEvents: 'coupleEvents',
      coupleMessages: 'coupleMessages',
    };
    for (const [emittedValue, expectedKey] of Object.entries(canonicalExpectation)) {
      expect(emitted).toContain(emittedValue);
      expect(storageKeyToDomainKey(expectedKey)).toBe(expectedKey);
    }
  });

  it('storageKeyToDomainKey maps storage keys to canonical domain keys', () => {
    // A representative storage key that used to be emitted raw must resolve.
    const chairSpecs = BACKUP_DOMAINS.find((d) => d.key === 'chairSpecs');
    expect(chairSpecs).toBeDefined();
    expect(storageKeyToDomainKey(chairSpecs!.storageKey)).toBe('chairSpecs');
    // Unknown keys fall back to 'all' rather than producing an untyped string.
    expect(storageKeyToDomainKey('spm_unknown_key')).toBe('all');
  });
});
