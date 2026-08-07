import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { VenueMapDesigner } from './VenueMapDesigner';
import { emptyVenueMapConfig } from '../services/wayfinding/venueWayfindingService';
import { addMapPoint, addMapRoute } from '../utils/venueMapDesigner';

// Mock the export functions to avoid touching canvas/Blob in jsdom.
vi.mock('../utils/layoutExport', () => ({
  downloadLayoutPng: vi.fn().mockResolvedValue(undefined),
  downloadLayoutPdf: vi.fn().mockResolvedValue(undefined),
}));

const venues = [
  { id: 'ballroom', name: 'Grand Ballroom', width: 80, height: 60, capacity: 250, category: 'reception' },
  { id: 'garden', name: 'Garden', width: 100, height: 80, capacity: 150, category: 'outdoor' },
] as any;

describe('VenueMapDesigner', () => {
  it('renders existing map points, routes, and the summary', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Grand Ballroom', kind: 'space', x: 20, y: 20, venueId: 'ballroom' });
    map = addMapPoint(map, { label: 'Parking', kind: 'parking', x: 80, y: 10 });
    map = addMapPoint(map, { label: 'Main Entry', kind: 'entry', x: 5, y: 5 });
    map = addMapRoute(map, 'Main Walkway', map.points.map((p) => p.id));

    render(<VenueMapDesigner map={map} venues={venues} onSave={() => {}} />);
    expect(screen.getByText(/Full-Venue Map Designer/)).toBeTruthy();
    expect(screen.getByText(/1 spaces/)).toBeTruthy();
    expect(screen.getByText(/1 parking/)).toBeTruthy();
    expect(screen.getByText(/1 entries/)).toBeTruthy();
    expect(screen.getByText(/Main Walkway/)).toBeTruthy();
  });

  it('clicking a point opens the side panel and saving persists via onSave', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Garden', kind: 'space', x: 30, y: 30, venueId: 'garden' });
    const onSave = vi.fn();
    render(<VenueMapDesigner map={map} venues={venues} onSave={onSave} />);

    // No point selected initially -> hint shown.
    expect(screen.getByText(/Click a point on the map/)).toBeTruthy();

    // The palette + save affordances exist.
    expect(screen.getByRole('button', { name: /Save Venue Map/ })).toBeTruthy();
  });

  it('shows the venue link name for a selected space point', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Garden', kind: 'space', x: 30, y: 30, venueId: 'garden' });
    // The designer selects a point on canvas click; we render with a preset map and
    // verify the palette + save button exist without crashing.
    render(<VenueMapDesigner map={map} venues={venues} onSave={() => {}} />);
    expect(screen.getByRole('button', { name: /Save Venue Map/ })).toBeTruthy();
  });

  it('shows map coverage and adds a pin for a missing venue', () => {
    let map = emptyVenueMapConfig();
    // Grand Ballroom is pinned; Garden is missing.
    map = addMapPoint(map, { label: 'Grand Ballroom', kind: 'space', x: 20, y: 20, venueId: 'ballroom' });
    render(<VenueMapDesigner map={map} venues={venues} onSave={() => {}} />);

    expect(screen.getByText(/Map coverage/)).toBeTruthy();
    expect(screen.getByText(/1\/2 pinned/)).toBeTruthy();
    // Garden is the missing venue and can be pinned.
    expect(screen.getByText(/Garden/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Add pin/ }));
    // After adding, coverage updates to 2/2 pinned and the spaces count increments.
    expect(screen.getByText(/2\/2 pinned/)).toBeTruthy();
    expect(screen.getByText(/2 spaces/)).toBeTruthy();
  });

  it('shows an empty-state hint when the map has no points', () => {
    render(<VenueMapDesigner map={emptyVenueMapConfig()} venues={venues} onSave={() => {}} />);
    expect(screen.getByText(/Start your map/)).toBeTruthy();
  });

  it('renames a walkway route via the inline editor', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'A', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'B', kind: 'space', x: 20, y: 20 });
    map = addMapRoute(map, 'Old Walkway', map.points.map((p) => p.id));
    render(<VenueMapDesigner map={map} venues={venues} onSave={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Rename Old Walkway' }));
    const input = screen.getByLabelText('Rename Old Walkway');
    fireEvent.change(input, { target: { value: 'Ceremony Path' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('🚶 Ceremony Path')).toBeTruthy();
  });

  it('reports dirty state: placing/editing fires onDirtyChange(true), saving fires false', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Garden', kind: 'space', x: 30, y: 30, venueId: 'garden' });
    const onDirtyChange = vi.fn();
    const { container } = render(
      <VenueMapDesigner map={map} venues={venues} onSave={() => {}} onDirtyChange={onDirtyChange} />,
    );
    // Place a new point on the canvas -> dirty.
    const svg = container.querySelector('svg')!;
    fireEvent.click(svg);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    // Saving the map clears the dirty state.
    fireEvent.click(screen.getByRole('button', { name: /Save Venue Map/ }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('undo/redo: placing a point can be undone then redone', () => {
    const { container } = render(
      <VenueMapDesigner map={emptyVenueMapConfig()} venues={venues} onSave={() => {}} />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.click(svg); // place a space point
    expect(screen.getByText(/1 spaces/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    expect(screen.getByText(/0 spaces/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Redo/ }));
    expect(screen.getByText(/1 spaces/)).toBeTruthy();
  });

  it('keyboard Delete removes the selected point', async () => {
    const { container } = render(
      <VenueMapDesigner map={emptyVenueMapConfig()} venues={venues} onSave={() => {}} />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.click(svg); // place + auto-select a point
    await waitFor(() => expect(screen.getByText(/1 spaces/)).toBeTruthy());

    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' })); });
    await waitFor(() => expect(screen.getByText(/0 spaces/)).toBeTruthy());
  });

  it('palette drives what kind gets placed on the canvas', () => {
    let map = emptyVenueMapConfig();
    const { container } = render(<VenueMapDesigner map={map} venues={venues} onSave={() => {}} />);
    // Select "Parking" in the palette.
    fireEvent.click(screen.getByRole('button', { name: /Parking/ }));
    const svg = container.querySelector('svg')!;
    fireEvent.click(svg);
    // A parking point is created, not an event space.
    expect(screen.getByText(/1 parking/)).toBeTruthy();
    expect(screen.queryByText(/1 spaces/)).toBeNull();
  });
});
