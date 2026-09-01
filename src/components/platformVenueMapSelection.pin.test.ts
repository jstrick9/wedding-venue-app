import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #270 (Phase 4 batch 8 — deferred P5 cleanup): pins the
 * PlatformVenueMap selected-marker highlight fix.
 *
 * The Leaflet map effect deliberately excludes `selectedId` from its deps —
 * rebuilding the map on every selection click was the freeze risk (full tile
 * layer + marker teardown per click). But that also meant the marker radius
 * highlight was computed at build time with a stale closure: selecting an
 * organization in the tiled view never visually enlarged its marker. Markers
 * are now kept in a ref map and a small effect syncs their radii on
 * selection change — no map rebuild, no stale highlight.
 */
describe('PlatformVenueMap selected-marker highlight (P5 from #263)', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/PlatformVenueMap.tsx'), 'utf8');

  it('map build effect stays off selectedId (no rebuild-per-click freeze)', () => {
    const deps = /\}, \[useTiles, locatedKey\]\);/.exec(src)?.[0] ?? '';
    expect(deps).not.toBe('');
  });

  it('markers are tracked in a ref so radii can be updated in place', () => {
    expect(src).toMatch(/markers\.set\(item\.organization\.id, marker\);/);
  });

  it('selection change syncs marker radii without rebuilding the map', () => {
    const effect = /useEffect\(\(\) => \{\s*markersRef\.current\.forEach\(\(marker, id\) => \{\s*marker\.setRadius\(selectedId === id \? MARKER_RADIUS_SELECTED : MARKER_RADIUS_DEFAULT\);/.exec(src)?.[0] ?? '';
    expect(effect).not.toBe('');
  });

  it('ref map is cleared on teardown and before rebuild', () => {
    expect(src).toMatch(/const markers = markersRef\.current;/);
  });
});
