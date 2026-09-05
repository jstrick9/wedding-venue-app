import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Venue-admin persona: the full-venue map designer is its own dedicated module
 * (`#/venuemap`) inside the Layout Studio rather than being buried in Admin.
 * Rendering AuthenticatedApp is too heavy for jsdom (see App.smoke.test.tsx),
 * so we statically guard the route wiring — the module must be reachable via the
 * hash route, exposed as a dedicated `view`, and the designer must actually render.
 */
const APP_PATH = resolve(__dirname, 'AuthenticatedApp.tsx');

describe('AuthenticatedApp full-venue map module route', () => {
  it('defines a dedicated "venuemap" view and hash route', () => {
    const source = readFileSync(APP_PATH, 'utf8');
    // view union includes 'venuemap'
    expect(source).toMatch(/'dashboard' \| 'studio' \| 'admin' \| 'venuemap'/);
    // hash routing handles #/venuemap
    expect(source).toMatch(/#\/venuemap/);
  });

  it('renders the VenueMapDesigner in a dedicated view branch', () => {
    const source = readFileSync(APP_PATH, 'utf8');
    // Imports the designer and the venue-map service helpers
    expect(source).toContain("import { VenueMapDesigner } from './VenueMapDesigner';");
    expect(source).toContain('getVenueMapConfig');
    expect(source).toContain('emptyVenueMapConfig');
    // Dedicated render branch that mounts the designer
    expect(source).toMatch(/view === 'venuemap'/);
    expect(source).toContain('<VenueMapDesigner');
    expect(source).toContain('saveVenueMapConfig');
    // saveVersionedStorage already emits the canonical domain event. A second
    // explicit emit here would race two backend writes for every map publish.
    expect(source).not.toMatch(/saveVenueMapConfig\(next\);\s*emitDataChanged\('venueMapConfigs'\)/);
  });

  it('routes the Studio "Design the full-venue map" shortcut to the module, not Admin', () => {
    const source = readFileSync(APP_PATH, 'utf8');
    // The shortcut no longer sets ADMIN_LAST_TAB / navigates to #/admin
    expect(source).not.toContain("localStorage.setItem(STORAGE_KEYS.ADMIN_LAST_TAB, 'wayfinding')");
    expect(source).toContain("window.location.hash = '#/venuemap';");
  });

  it('guards hash/back navigation and browser unload while the map draft is dirty', () => {
    const source = readFileSync(APP_PATH, 'utf8');
    expect(source).toContain("viewRef.current === 'venuemap' && venueMapDirtyRef.current");
    expect(source).toContain("window.history.replaceState(window.history.state, '', '#/venuemap')");
    expect(source).toContain('layoutState.layoutDirty || venueMapDirty');
    expect(source).toContain('pendingVenueMapHash');
  });

  it('does not render a cached venue map before the current tenant is hydrated', () => {
    const source = readFileSync(APP_PATH, 'utf8');
    expect(source).toContain('if (!entityBackendSync.hydrated)');
    expect(source).toContain('entityBackendSync.loadError');
    expect(source).toContain('entityBackendSync.loadFromBackend()');
    expect(source).toContain("detail?.source === 'backend'");
  });
});
