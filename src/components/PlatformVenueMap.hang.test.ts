import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PlatformVenueMap hang guards', () => {
  it('times out Geoapify tiles and reports the error to the operator', () => {
    const service = readFileSync(join(process.cwd(), 'src/services/platform/geocodingService.ts'), 'utf8');
    const fetchSlice = service.slice(service.indexOf('export async function fetchGeoapifyTile'));
    expect(fetchSlice).toContain('withTimeout');
    expect(fetchSlice).toContain('15000');
    expect(fetchSlice).toContain('Loading map tiles timed out');
    expect(fetchSlice).toContain('authorizedFetch');

    const map = readFileSync(join(process.cwd(), 'src/components/PlatformVenueMap.tsx'), 'utf8');
    const tileSlice = map.slice(map.indexOf('createTile'), map.indexOf('new GeoapifyAuthedTiles'));
    expect(tileSlice).toContain('fetchGeoapifyTile');
    expect(tileSlice).toContain('setTileError');
    expect(tileSlice).toContain('done(');
  });
});
