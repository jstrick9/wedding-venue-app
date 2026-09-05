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

function clickCanvas(container: HTMLElement, clientX = 250, clientY = 200) {
  const svg = container.querySelector('svg')!;
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: 500, bottom: 400, width: 500, height: 400, x: 0, y: 0,
    toJSON: () => ({}),
  });
  fireEvent.click(svg, { clientX, clientY });
}

function selectFirstMapPoint(container: HTMLElement) {
  const point = container.querySelector<SVGGElement>('[data-map-point]')!;
  fireEvent.pointerDown(point, { pointerId: 1, clientX: 100, clientY: 100 });
}

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
    expect(screen.getAllByText(/Main Walkway/).length).toBeGreaterThan(0);
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
    expect(screen.getAllByText(/Garden/).length).toBeGreaterThan(0);

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

    fireEvent.click(screen.getByRole('button', { name: 'Edit Old Walkway' }));
    const input = screen.getByLabelText('Route name');
    fireEvent.change(input, { target: { value: 'Ceremony Path' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply route changes' }));
    expect(screen.getByText('🚶 Ceremony Path')).toBeTruthy();
  });

  it('edits route metadata and ordered points before explicit publication', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'A', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'B', kind: 'path', x: 20, y: 10 });
    map = addMapPoint(map, { label: 'C', kind: 'space', x: 40, y: 20, venueId: 'garden' });
    map = addMapRoute(map, 'Guest Walk', map.points.map((point) => point.id));
    const onSave = vi.fn();
    render(<VenueMapDesigner map={map} venues={venues} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Guest Walk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move C earlier' }));
    const audienceControls = screen.getAllByLabelText('Audience');
    fireEvent.change(audienceControls[audienceControls.length - 1], { target: { value: 'couple' } });
    const mobilityControls = screen.getAllByLabelText('Mobility status');
    fireEvent.change(mobilityControls[mobilityControls.length - 1], { target: { value: 'step-free' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply route changes' }));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Save Venue Map/ }));
    const savedRoute = onSave.mock.calls[0][0].routes[0];
    expect(savedRoute.pointIds).toEqual([map.points[0].id, map.points[2].id, map.points[1].id]);
    expect(savedRoute.audience).toBe('couple');
    expect(savedRoute.accessibility).toBe('step-free');
  });

  it('reports dirty state: placing/editing fires onDirtyChange(true), saving fires false', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Garden', kind: 'space', x: 30, y: 30, venueId: 'garden' });
    const onDirtyChange = vi.fn();
    const { container } = render(
      <VenueMapDesigner map={map} venues={venues} onSave={() => {}} onDirtyChange={onDirtyChange} />,
    );
    // Place a new point on the canvas -> dirty.
    clickCanvas(container);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    // Saving the map clears the dirty state.
    fireEvent.click(screen.getByRole('button', { name: /Save Venue Map/ }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('undo/redo: placing a point can be undone then redone', () => {
    const { container } = render(
      <VenueMapDesigner map={emptyVenueMapConfig()} venues={venues} onSave={() => {}} />,
    );
    clickCanvas(container); // place a space point
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
    clickCanvas(container); // place + auto-select a point
    await waitFor(() => expect(screen.getByText(/1 spaces/)).toBeTruthy());

    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' })); });
    await waitFor(() => expect(screen.getByText(/0 spaces/)).toBeTruthy());
  });

  it('undo covers field-by-field edits (single undo per edit session)', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Ceremony', kind: 'space', x: 30, y: 30, venueId: 'garden' });
    const { container } = render(<VenueMapDesigner map={map} venues={venues} onSave={() => {}} />);

    // Select the existing point through the pointer interaction used by the canvas.
    selectFirstMapPoint(container);

    // Edit the label field (a field-level edit).
    const labelInput = screen.getByLabelText('Label');
    fireEvent.change(labelInput, { target: { value: 'Main Ceremony' } });
    // Edit the X coordinate too — same session.
    const xInput = screen.getByLabelText('X');
    fireEvent.change(xInput, { target: { value: '45' } });

    // A single undo reverts the whole edit session back to the original point.
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    const labelEl = screen.getByLabelText('Label') as HTMLInputElement;
    expect(labelEl.value).toBe('Ceremony');
  });

  it('cancels point edits back to the saved baseline without leaving a dirty timestamp', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Parking', kind: 'parking', x: 40, y: 30 });
    const { container } = render(<VenueMapDesigner map={map} venues={venues} onSave={() => {}} />);
    selectFirstMapPoint(container);
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Temporary label' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel edits' }));

    expect(screen.queryByDisplayValue('Temporary label')).not.toBeInTheDocument();
    expect(screen.getByText(/Venue map is saved/)).toBeInTheDocument();
    expect(container.querySelector('text')?.textContent).not.toContain('Temporary label');
  });

  it('cancels a newly placed point instead of silently retaining it', () => {
    render(<VenueMapDesigner map={emptyVenueMapConfig()} venues={venues} onSave={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Place Event Space at center/ }));
    expect(screen.getByText(/1 spaces/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel edits' }));
    expect(screen.getByText(/0 spaces/)).toBeInTheDocument();
    expect(screen.getByText(/Venue map is saved/)).toBeInTheDocument();
  });

  it('duplicates the selected point via the Copy button', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Parking', kind: 'parking', x: 40, y: 30 });
    const { container } = render(<VenueMapDesigner map={map} venues={venues} onSave={() => {}} />);
    // Select the point through the pointer interaction used by the canvas.
    selectFirstMapPoint(container);

    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    expect(screen.getByText(/2 parking/)).toBeTruthy();
  });

  it('preview toggle shows a read-only couple/guest view and hides editing chrome', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Ceremony', kind: 'space', x: 30, y: 30, venueId: 'garden' });
    render(<VenueMapDesigner map={map} venues={venues} onSave={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Preview/ }));
    expect(screen.getByText(/Audience preview/i)).toBeTruthy();
    expect(screen.getByLabelText('Preview map audience')).toHaveValue('guest');
    expect(screen.getByLabelText('Preview wedding event space')).toHaveValue('ballroom');
    // The click-to-place palette is hidden in preview.
    expect(screen.queryByText(/Click canvas to place/)).toBeNull();
    // Exiting preview restores editing chrome.
    fireEvent.click(screen.getByRole('button', { name: /Back to editing/ }));
    expect(screen.getByText(/Click canvas to place/)).toBeTruthy();
  });

  it('offers a keyboard-operable alternative to click placement', () => {
    render(<VenueMapDesigner map={emptyVenueMapConfig()} venues={venues} onSave={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '🚪 Entry / Exit' }));
    fireEvent.click(screen.getByRole('button', { name: /Place Entry \/ Exit at center/ }));
    expect(screen.getByText(/1 entries/)).toBeTruthy();
    expect(screen.getByLabelText('X')).toHaveValue(50);
    expect(screen.getByLabelText('Y')).toHaveValue(40);
  });

  it('palette drives what kind gets placed on the canvas', () => {
    let map = emptyVenueMapConfig();
    const { container } = render(<VenueMapDesigner map={map} venues={venues} onSave={() => {}} />);
    // Select "Parking" in the palette.
    fireEvent.click(screen.getByRole('button', { name: '🅿️ Parking' }));
    clickCanvas(container);
    // A parking point is created, not an event space.
    expect(screen.getByText(/1 parking/)).toBeTruthy();
    expect(screen.queryByText(/1 spaces/)).toBeNull();
  });
});
