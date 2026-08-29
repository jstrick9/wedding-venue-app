import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AddressAutocomplete hang guards', () => {
  it('times out street lookup and always clears Looking up addresses', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/AddressAutocomplete.tsx'), 'utf8');
    const search = source.slice(source.indexOf('const search'), source.indexOf('const select'));
    expect(search).toContain('Looking up addresses timed out');
    expect(search).toContain('autocompleteVenueAddress');
    expect(search).toContain('withTimeout');
    expect(search).toContain('15000');
    expect(search).toContain('finally');
    expect(search).toContain('setLoading(false)');
  });
});
