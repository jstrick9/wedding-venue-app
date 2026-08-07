import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { VenueMapCanvas } from './VenueMapCanvas';
import { emptyVenueMapConfig } from '../services/wayfinding/venueWayfindingService';
import { addMapPoint } from '../utils/venueMapDesigner';

describe('VenueMapCanvas', () => {
  it('places the active palette kind when clicking empty canvas (not hardcoded space)', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Main Entry', kind: 'entry', x: 10, y: 10 });
    const onPlacePoint = vi.fn();
    const { container } = render(
      <VenueMapCanvas
        map={map}
        editable
        placeKind="parking"
        onPlacePoint={onPlacePoint}
      />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.click(svg);
    // Called with the chosen kind, not a hardcoded 'space'.
    expect(onPlacePoint).toHaveBeenCalledTimes(1);
    expect(onPlacePoint.mock.calls[0][0]).toBe('parking');
  });

  it('renders a highlight ring around points in the in-progress route', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'A', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'B', kind: 'space', x: 20, y: 20 });
    const id = map.points[0].id;
    const { container } = render(
      <VenueMapCanvas
        map={map}
        editable
        highlightPointIds={[id]}
      />,
    );
    // The highlighted point renders a dashed brand-colored ring circle.
    const rings = container.querySelectorAll('circle[stroke="#4A1942"]');
    expect(rings.length).toBe(1);
  });

  it('renders a color legend for the kinds present when showLegend is true', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Parking', kind: 'parking', x: 20, y: 20 });
    map = addMapPoint(map, { label: 'Entry', kind: 'entry', x: 40, y: 20 });
    const { container } = render(
      <VenueMapCanvas
        map={map}
        showLegend
      />,
    );
    // Legend text is drawn inside the SVG for the kinds present.
    const text = [...container.querySelectorAll('text')].map((t) => t.textContent || '');
    expect(text.join(' ')).toContain('Parking');
    expect(text.join(' ')).toContain('Entry / Exit');
    // Does not include a kind absent from the map.
    expect(text.join(' ')).not.toContain('Event Space');
  });

  it('does not place a point when clicking directly on an existing point in editable mode', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Parking', kind: 'parking', x: 20, y: 20 });
    const onPlacePoint = vi.fn();
    const { container } = render(
      <VenueMapCanvas
        map={map}
        editable
        placeKind="parking"
        onPlacePoint={onPlacePoint}
      />,
    );
    const circle = container.querySelectorAll('circle')[0];
    // Simulate a click that originates on the point's circle (target !== svg).
    const svg = container.querySelector('svg')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: circle });
    Object.defineProperty(event, 'currentTarget', { value: svg });
    svg.dispatchEvent(event);
    expect(onPlacePoint).not.toHaveBeenCalled();
  });
});
