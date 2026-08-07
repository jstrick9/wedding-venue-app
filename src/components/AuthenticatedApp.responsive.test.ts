import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Venue-admin persona / Design Studio: mobile & tablet responsiveness.
 * Rendering AuthenticatedApp is heavy for jsdom, so we statically guard the key
 * responsive behaviors:
 *   - side panels become overlays on small screens (canvas gets full width), and
 *   - the canvas drag/pan uses pointer events (works on touch, not just mouse).
 */
const PATH = resolve(__dirname, 'AuthenticatedApp.tsx');
const CANVAS = resolve(__dirname, 'FloorPlanCanvas.tsx');

describe('Design Studio mobile/tablet responsiveness', () => {
  it('overlays the Sidebar and PropertiesPanel on small screens', () => {
    const source = readFileSync(PATH, 'utf8');
    // Sidebar overlay (left)
    expect(source).toMatch(/absolute top-0 bottom-0 left-0 z-30 flex/);
    // PropertiesPanel overlay (right)
    expect(source).toMatch(/absolute top-0 bottom-0 right-0 z-30 flex/);
    // Mobile is detected via matchMedia
    expect(source).toMatch(/matchMedia\('\(max-width: 767px\)'\)/);
    // Small screens start collapsed so the canvas is maximized
    expect(source).toMatch(/setSidebarCollapsed\(true\)/);
    expect(source).toMatch(/setShowProperties\(false\)/);
  });

  it('does not persist the mobile-forced collapse over desktop prefs', () => {
    const source = readFileSync(PATH, 'utf8');
    expect(source).toMatch(/isMobileRef\.current\b/);
    expect(source).toMatch(/if \(isMobileRef\.current\) return;/);
  });

  it('uses pointer events for canvas drag/pan (touch support)', () => {
    const source = readFileSync(CANVAS, 'utf8');
    expect(source).toMatch(/onPointerDown=\{handlePanStart\}/);
    expect(source).toMatch(/handleItemPointerDown/);
    expect(source).toMatch(/pointermove/);
    expect(source).toMatch(/pointerup/);
    expect(source).toMatch(/touchAction/);
    // No remaining mouse-only item drag handlers.
    expect(source).not.toMatch(/onMouseDown=\{handleItemMouseDown\}/);
  });
});
