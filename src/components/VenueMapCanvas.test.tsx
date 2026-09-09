import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, within } from '@testing-library/react';
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

  it('keeps extreme aspect ratios readable in a keyboard-pannable bounded viewport', () => {
    const wideMap = {
      ...emptyVenueMapConfig(),
      width: 500,
      height: 20,
      points: [{ id: 'gate', label: 'Gate', kind: 'entry' as const, x: 5, y: 5 }],
    };
    const { container, rerender } = render(<VenueMapCanvas map={wideMap} />);
    const viewport = container.querySelector<HTMLElement>('[data-map-scroll-viewport]')!;
    const scrollBy = vi.fn();
    Object.defineProperty(viewport, 'scrollBy', { configurable: true, value: scrollBy });

    expect(viewport).toHaveAttribute('tabindex', '0');
    expect(viewport).toHaveAttribute('aria-label', 'Scrollable venue map viewport');
    expect(viewport).toHaveClass('max-h-[70vh]', 'overflow-auto');
    expect(container.querySelector('svg')).toHaveStyle({ width: '6000px', maxWidth: 'none' });
    expect(screen.getByText(/extra-wide or extra-tall layout/i)).toBeInTheDocument();

    fireEvent.keyDown(viewport, { key: 'ArrowRight' });
    expect(scrollBy).toHaveBeenCalledWith({ left: 64, top: 0, behavior: 'smooth' });

    rerender(<VenueMapCanvas map={{ ...wideMap, width: 20, height: 500 }} />);
    expect(container.querySelector('svg')).toHaveStyle({ width: '240px', marginInline: 'auto' });

    rerender(<VenueMapCanvas map={emptyVenueMapConfig()} />);
    const standardViewport = container.querySelector<HTMLElement>('[data-map-scroll-viewport]')!;
    expect(standardViewport).not.toHaveAttribute('tabindex');
    expect(container.querySelector('svg')).not.toHaveStyle({ width: '6000px' });
  });

  it('renders labels for supported legacy circles and lines', () => {
    const map = {
      ...emptyVenueMapConfig(),
      drawings: [
        { id: 'circle', type: 'circle', x: 20, y: 20, radius: 5, text: 'Round garden' },
        { id: 'line', type: 'line', x: 0, y: 0, points: [{ x: 1, y: 1 }, { x: 10, y: 10 }], text: 'Fence line' },
      ],
    };
    const { container } = render(<VenueMapCanvas map={map} />);

    expect(container.querySelector('circle')).toBeInTheDocument();
    expect(container.querySelector('polyline')).toBeInTheDocument();
    const labels = [...container.querySelectorAll('svg text')].map((node) => node.textContent);
    expect(labels).toContain('Round garden');
    expect(labels).toContain('Fence line');
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

  it('provides large editor selection targets independent of map aspect ratio', () => {
    let map = { ...emptyVenueMapConfig(), width: 500, height: 20 };
    map = addMapPoint(map, {
      label: 'Main Gate', kind: 'entry', x: 10, y: 10,
    });
    map = addMapPoint(map, {
      label: 'Path Node 1', kind: 'path', x: 250, y: 10,
    });
    const onSelectPoint = vi.fn();
    render(
      <VenueMapCanvas
        map={map}
        editable
        selectedPointId={map.points[0].id}
        onSelectPoint={onSelectPoint}
      />,
    );

    const summary = screen.getByText('Map points for editing').closest('summary')!;
    fireEvent.click(summary);
    const details = summary.closest('details')!;
    const selectedAction = within(details).getByRole('button', { name: /Select Main Gate for editing/i });
    const pathAction = within(details).getByRole('button', { name: /Select Path Node 1 for editing/i });
    expect(selectedAction).toHaveAttribute('aria-pressed', 'true');
    expect(pathAction).toHaveClass('min-h-11');
    expect(pathAction).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pathAction);
    expect(onSelectPoint).toHaveBeenCalledWith(map.points[1].id);
  });

  it('exposes read-only points as named keyboard actions', () => {
    const map = addMapPoint(emptyVenueMapConfig(), {
      label: 'Main Gate', kind: 'entry', x: 10, y: 10, lat: 35.2, lng: -80.8,
    });
    const onPointClick = vi.fn();
    render(<VenueMapCanvas map={map} onPointClick={onPointClick} />);
    const point = document.querySelector(`[data-map-point="${map.points[0].id}"]`)!;
    expect(point.getAttribute('aria-label')).toMatch(/Main Gate.*Open in maps\./i);
    fireEvent.focus(point);
    expect(document.querySelector(`[data-map-focus-ring="${map.points[0].id}"]`)).toBeInTheDocument();
    fireEvent.keyDown(point, { key: 'Enter' });
    expect(onPointClick).toHaveBeenCalledWith(map.points[0]);
    fireEvent.blur(point);
    expect(document.querySelector('[data-map-focus-ring]')).not.toBeInTheDocument();
  });

  it('provides the same filtered read-only action in a large touch-target list', () => {
    let map = addMapPoint(emptyVenueMapConfig(), {
      label: 'Main Gate', kind: 'entry', x: 10, y: 10, lat: 35.2, lng: -80.8,
    });
    map = addMapPoint(map, {
      label: 'No action', kind: 'amenity', x: 20, y: 20,
    });
    const onPointClick = vi.fn();
    render(
      <VenueMapCanvas
        map={map}
        onPointClick={onPointClick}
        isPointInteractive={(point) => point.lat !== undefined && point.lng !== undefined}
        pointActionLabel={() => 'Open directions.'}
      />,
    );

    const summary = screen.getByText('Map location actions').closest('summary')!;
    fireEvent.click(summary);
    const details = summary.closest('details')!;
    const action = within(details).getByRole('button', { name: /Main Gate.*Open directions/i });
    expect(action).toHaveClass('min-h-11');
    expect(within(details).queryByRole('button', { name: /No action/i })).not.toBeInTheDocument();
    fireEvent.click(action);
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

    expect(container.querySelectorAll('[data-map-point][role="button"]')).toHaveLength(1);
    const gate = container.querySelector(`[data-map-point="${map.points[0].id}"]`)!;
    expect(gate.getAttribute('aria-label')).toMatch(/Main Gate.*Open directions/i);
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

  it('visibly and accessibly identifies emergency-only walkways', () => {
    const map: VenueMapConfig = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'gate', label: 'Gate', kind: 'entry', x: 5, y: 5 },
        { id: 'assembly', label: 'Assembly', kind: 'amenity', x: 30, y: 20 },
      ],
      routes: [{
        id: 'emergency',
        name: 'North Evacuation',
        pointIds: ['gate', 'assembly'],
        priority: 'emergency-only',
      }],
    };
    const { container } = render(<VenueMapCanvas map={map} />);

    expect(container.querySelector('polyline')).toHaveAttribute('stroke', '#b91c1c');
    expect([...container.querySelectorAll('text')].some((node) =>
      node.textContent?.includes('Emergency only: North Evacuation'))).toBe(true);
    expect(container.querySelector('.sr-only')).toHaveTextContent(
      /North Evacuation\. Routing priority: Emergency only\./i,
    );
  });
});
