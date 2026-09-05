import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { VenueMapCanvas, clientPointToVenueMap } from './VenueMapCanvas';
import { emptyVenueMapConfig } from '../services/wayfinding/venueWayfindingService';
import { addMapPoint } from '../utils/venueMapDesigner';
import type { VenueMapConfig } from '../types';

function setCanvasRect(svg: SVGSVGElement, width = 500, height = 400) {
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('VenueMapCanvas', () => {
  it('maps pointer coordinates through letterboxed xMidYMid meet content', () => {
    // A 100x80 map inside a 1000x400 viewport renders 500px wide, centered
    // with 250px side gutters. The visible center remains map coordinate 50,40.
    expect(clientPointToVenueMap(
      { left: 0, top: 0, width: 1000, height: 400 },
      100,
      80,
      500,
      200,
    )).toEqual({ x: 50, y: 40, inside: true });
    expect(clientPointToVenueMap(
      { left: 0, top: 0, width: 1000, height: 400 },
      100,
      80,
      100,
      200,
    ).inside).toBe(false);
  });

  it('places the active palette kind at the clicked map coordinate', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Main Entry', kind: 'entry', x: 10, y: 10 });
    const onPlacePoint = vi.fn();
    const { container } = render(
      <VenueMapCanvas map={map} editable placeKind="parking" onPlacePoint={onPlacePoint} />,
    );
    const svg = container.querySelector('svg')!;
    setCanvasRect(svg);
    fireEvent.click(svg, { clientX: 250, clientY: 200 });
    expect(onPlacePoint).toHaveBeenCalledWith('parking', 50, 40);
  });

  it('allows placement over a full-size base image but not on an existing point', () => {
    let map: VenueMapConfig = { ...emptyVenueMapConfig(), backgroundImageUrl: 'data:image/png;base64,abc' };
    map = addMapPoint(map, { label: 'Parking', kind: 'parking', x: 20, y: 20 });
    const onPlacePoint = vi.fn();
    const { container } = render(
      <VenueMapCanvas map={map} editable placeKind="parking" onPlacePoint={onPlacePoint} />,
    );
    const svg = container.querySelector('svg')!;
    setCanvasRect(svg);
    fireEvent.click(container.querySelector('image')!, { clientX: 250, clientY: 200 });
    expect(onPlacePoint).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector('[data-map-point] circle')!);
    expect(onPlacePoint).toHaveBeenCalledTimes(1);
  });

  it('supports pointer dragging and keyboard point movement', () => {
    const map = addMapPoint(emptyVenueMapConfig(), {
      label: 'Main Gate', kind: 'entry', x: 10, y: 10,
    });
    const onMovePoint = vi.fn();
    const onSelectPoint = vi.fn();
    const { container } = render(
      <VenueMapCanvas
        map={map}
        editable
        onMovePoint={onMovePoint}
        onSelectPoint={onSelectPoint}
      />,
    );
    const svg = container.querySelector('svg')!;
    setCanvasRect(svg);
    const point = screen.getByRole('button', { name: /Entry \/ Exit: Main Gate/i });

    fireEvent.pointerDown(point, { pointerId: 7, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(svg, { pointerId: 7, clientX: 100, clientY: 100 });
    expect(onSelectPoint).toHaveBeenCalledWith(map.points[0].id);
    expect(onMovePoint).toHaveBeenCalled();

    fireEvent.keyDown(point, { key: 'ArrowRight' });
    expect(onMovePoint).toHaveBeenLastCalledWith(map.points[0].id, 11, 10);
  });

  it('exposes read-only points as named keyboard actions', () => {
    const map = addMapPoint(emptyVenueMapConfig(), {
      label: 'Main Gate', kind: 'entry', x: 10, y: 10, lat: 35.2, lng: -80.8,
    });
    const onPointClick = vi.fn();
    render(<VenueMapCanvas map={map} onPointClick={onPointClick} />);
    const point = screen.getByRole('button', { name: /Main Gate.*Open in maps available/i });
    fireEvent.keyDown(point, { key: 'Enter' });
    expect(onPointClick).toHaveBeenCalledWith(map.points[0]);
  });

  it('does not expose no-op read-only points as buttons', () => {
    let map = addMapPoint(emptyVenueMapConfig(), {
      label: 'Main Gate', kind: 'entry', x: 10, y: 10, lat: 35.2, lng: -80.8,
    });
    map = addMapPoint(map, {
      label: 'Unmapped Restroom', kind: 'amenity', x: 20, y: 20,
    });
    const onPointClick = vi.fn();
    const { container } = render(
      <VenueMapCanvas
        map={map}
        onPointClick={onPointClick}
        isPointInteractive={(point) => point.lat !== undefined && point.lng !== undefined}
        pointActionLabel={() => 'Open directions.'}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    const gate = screen.getByRole('button', { name: /Main Gate.*Open directions/i });
    fireEvent.keyDown(gate, { key: 'Enter' });
    fireEvent.click(container.querySelector(`[data-map-point="${map.points[1].id}"]`)!);
    expect(onPointClick).toHaveBeenCalledTimes(1);
    expect(onPointClick).toHaveBeenCalledWith(map.points[0]);
  });

  it('renders a highlight ring and a legend for kinds present', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'A', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'B', kind: 'parking', x: 20, y: 20 });
    const id = map.points[0].id;
    const { container } = render(
      <VenueMapCanvas map={map} editable highlightPointIds={[id]} showLegend />,
    );
    expect(container.querySelectorAll('circle[stroke="#4A1942"]')).toHaveLength(1);
    const text = [...container.querySelectorAll('text')].map((node) => node.textContent || '').join(' ');
    expect(text).toContain('Parking');
    expect(text).toContain('Entry / Exit');
    expect(text).not.toContain('Event Space');
  });
});
