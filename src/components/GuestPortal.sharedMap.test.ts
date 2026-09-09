import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guest-persona / wayfinding: the guest portal's venue maps (the "Venue Map"
 * card and the Wayfinding tab) use the shared `VenueMapCanvas` renderer rather
 * than a hand-rolled SVG. Rendering GuestPortal under jsdom is heavy, so we
 * statically guard that the shared renderer is used and the duplicated SVG
 * map code (routePolyline) is gone — one source of truth for the map.
 */
const PATH = resolve(__dirname, 'GuestPortal.tsx');

describe('GuestPortal uses the shared VenueMapCanvas', () => {
  it('imports and renders VenueMapCanvas for the venue map + wayfinding', () => {
    const source = readFileSync(PATH, 'utf8');
    expect(source).toContain("import { VenueMapCanvas } from './VenueMapCanvas';");
    const uses = (source.match(/<VenueMapCanvas/g) || []).length;
    expect(uses).toBeGreaterThanOrEqual(2); // Venue Map card + Wayfinding tab
    expect(source).toContain('onPointClick={openInMaps}');
    expect(source).toContain('isPointInteractive={hasValidMapGps}');
  });

  it('quarantines colliding rain plans before expanding a guest venue scope', () => {
    const source = readFileSync(PATH, 'utf8');
    expect(source).toMatch(
      /collisionSafeRainPlans = activeVenueMap[\s\S]*?partitionVenueMapRainContingencyCollisions\(activeVenueMap\)\.map\.rainContingencies[\s\S]*?const backupIds = collisionSafeRainPlans/,
    );
  });

  it('no longer contains the duplicated hand-rolled map SVG / routePolyline', () => {
    const source = readFileSync(PATH, 'utf8');
    expect(source).not.toContain('routePolyline');
    expect(source).not.toContain('const pts = routePolyline');
  });
});
