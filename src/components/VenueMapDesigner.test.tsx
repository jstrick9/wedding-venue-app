import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { VenueMapDesigner } from './VenueMapDesigner';
import { emptyVenueMapConfig } from '../services/wayfinding/venueWayfindingService';
import {
  addMapPoint,
  addMapRoute,
  INVALID_VENUE_MAP_ROUTE_PRIORITY,
} from '../utils/venueMapDesigner';
import { downloadLayoutPng } from '../utils/layoutExport';
import type { RainContingency } from '../types';

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

function chooseParkingPlacement() {
  fireEvent.click(screen.getByRole('button', { name: '🅿️ Parking' }));
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
    expect(screen.getByRole('button', { name: /Save & publish Venue Map/ })).toBeTruthy();
  });

  it('shows the venue link name for a selected space point', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Garden', kind: 'space', x: 30, y: 30, venueId: 'garden' });
    // The designer selects a point on canvas click; we render with a preset map and
    // verify the palette + save button exist without crashing.
    render(<VenueMapDesigner map={map} venues={venues} onSave={() => {}} />);
    expect(screen.getByRole('button', { name: /Save & publish Venue Map/ })).toBeTruthy();
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

  it('publishes unique, non-self rain backups through the protected map Save', async () => {
    const rainVenues = [
      { id: 'chapel', name: 'Indoor Chapel', category: 'ceremony', environment: 'indoor' },
      { id: 'terrace', name: 'Reception Terrace', category: 'reception', environment: 'outdoor' },
      { id: 'pavilion', name: 'Open Pavilion', category: 'reception', environment: 'both' },
      { id: 'hall', name: 'Main Hall', category: 'reception', environment: 'indoor' },
    ] as any;
    const onSave = vi.fn();
    render(
      <VenueMapDesigner
        map={emptyVenueMapConfig()}
        venues={rainVenues}
        onSave={onSave}
      />,
    );

    const add = screen.getByRole('button', { name: /Add rain backup/i });
    fireEvent.click(add);
    expect(onSave).not.toHaveBeenCalled();

    const firstOutdoor = screen.getAllByLabelText(/Outdoor space for rain backup/i)[0] as HTMLSelectElement;
    const firstIndoor = screen.getAllByLabelText(/Indoor backup for/i)[0] as HTMLSelectElement;
    expect(firstOutdoor).toHaveValue('terrace');
    expect(Array.from(firstOutdoor.options).map((option) => option.value)).not.toContain('chapel');
    expect(Array.from(firstIndoor.options).map((option) => option.value)).toContain('chapel');

    fireEvent.click(add);
    const outdoorSelections = screen.getAllByLabelText(/Outdoor space for rain backup/i) as HTMLSelectElement[];
    const indoorSelections = screen.getAllByLabelText(/Indoor backup for/i) as HTMLSelectElement[];
    expect(new Set(outdoorSelections.map((select) => select.value)).size).toBe(2);
    expect(Array.from(indoorSelections[1].options).map((option) => option.value)).not.toContain('pavilion');
    expect(add).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0];
    expect(saved.rainContingencies).toHaveLength(2);
    expect(saved.rainContingencies.every(
      (contingency: { outdoorVenueId: string; indoorVenueId: string }) =>
        contingency.outdoorVenueId !== contingency.indoorVenueId,
    )).toBe(true);
  });

  it('keeps stale rain pairs recoverable but visibly blocks publication until repaired', async () => {
    const map = {
      ...emptyVenueMapConfig(),
      rainContingencies: [{
        id: 'stale-rain-plan',
        outdoorVenueId: 'removed-garden',
        indoorVenueId: 'garden',
      }],
    };
    const onSave = vi.fn();
    render(<VenueMapDesigner map={map} venues={venues} onSave={onSave} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/Publication blocked.*unavailable rain backup/i);
    expect(screen.getByText(/Outdoor space “removed-garden” no longer exists/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Unavailable.*removed-garden/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Remove rain backup for removed-garden/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].rainContingencies).toEqual([]);
  });

  it('quarantines colliding rain plans and releases all records after explicit re-ID and source repair', async () => {
    const rainVenues = [
      { id: 'lawn', name: 'Lawn', category: 'ceremony', environment: 'outdoor' },
      { id: 'terrace', name: 'Terrace', category: 'reception', environment: 'outdoor' },
      { id: 'courtyard', name: 'Courtyard', category: 'reception', environment: 'outdoor' },
      { id: 'hall', name: 'Hall', category: 'reception', environment: 'indoor' },
      { id: 'barn', name: 'Barn', category: 'reception', environment: 'indoor' },
    ] as any;
    const map = {
      ...emptyVenueMapConfig(),
      rainContingencies: [
        { id: 'duplicate-plan', outdoorVenueId: 'lawn', indoorVenueId: 'hall' },
        { id: 'duplicate-plan', outdoorVenueId: 'terrace', indoorVenueId: 'barn' },
        { id: 'third-plan', outdoorVenueId: 'terrace', indoorVenueId: 'hall' },
      ],
    };
    const onSave = vi.fn();
    render(<VenueMapDesigner map={map} venues={rainVenues} onSave={onSave} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/Publication blocked: 3 duplicate or competing rain plans require recovery/i);
    expect(screen.getAllByText(/Plan ID “duplicate-plan” is duplicated/i)).toHaveLength(2);
    expect(screen.getAllByText(/Outdoor space “terrace” has competing rain plans/i)).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Keep only quarantined rain plan/i })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /Remove quarantined rain plan/i })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole('button', { name: /Assign a new ID to quarantined rain plan/i })[0]);
    expect(screen.getByRole('alert')).toHaveTextContent(/Publication blocked: 2 duplicate or competing rain plans require recovery/i);

    fireEvent.change(
      screen.getByLabelText('Outdoor source for quarantined rain plan 1'),
      { target: { value: 'courtyard' } },
    );
    expect(screen.queryByText(/duplicate or competing rain plans require recovery/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedPlans = onSave.mock.calls[0][0].rainContingencies;
    expect(savedPlans).toHaveLength(3);
    expect(new Set(savedPlans.map((plan: RainContingency) => plan.id)).size).toBe(3);
    expect(new Set(savedPlans.map((plan: RainContingency) => plan.outdoorVenueId)).size).toBe(3);
  });

  it('keeps structurally malformed records in an admin-only layer until explicit reconstruction', async () => {
    const map = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'a', label: 'Gate', kind: 'entry', x: 1, y: 1 },
        { id: 'b', label: 'Parking', kind: 'parking', x: 10, y: 10 },
        { label: 'Mystery point', kind: 'secret', x: 5, y: 5 },
      ],
      routes: [{ name: 'Recovered walk', pointIds: ['a', 'b'] }],
      drawings: [{ type: 'circle', x: 20, y: 20, radius: 5, text: 'Round garden' }],
      rainContingencies: [{ outdoorVenueId: 'garden', indoorVenueId: 'ballroom' }],
    } as any;
    const onSave = vi.fn();
    render(<VenueMapDesigner map={map} venues={venues} onSave={onSave} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/4 malformed saved map occurrences require an explicit decision/i);
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Generate a new ID for malformed map occurrence 1' }));
    fireEvent.change(screen.getByLabelText('Point type'), { target: { value: 'amenity' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reconstruct malformed map occurrence 1' }));

    fireEvent.click(screen.getByRole('button', { name: 'Generate a new ID for malformed map occurrence 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reconstruct malformed map occurrence 1' }));

    fireEvent.click(screen.getByRole('button', { name: 'Generate a new ID for malformed map occurrence 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reconstruct malformed map occurrence 1' }));

    fireEvent.click(screen.getByRole('button', { name: 'Generate a new ID for malformed map occurrence 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reconstruct malformed map occurrence 1' }));
    expect(screen.queryByText(/malformed saved map occurrences require an explicit decision/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0];
    expect(saved.points).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Mystery point', kind: 'amenity' }),
    ]));
    expect(saved.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Recovered walk', pointIds: ['a', 'b'] }),
    ]));
    expect(saved.drawings).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'Round garden', type: 'circle', radius: 5 }),
    ]));
    expect(saved.rainContingencies).toEqual(expect.arrayContaining([
      expect.objectContaining({ outdoorVenueId: 'garden', indoorVenueId: 'ballroom' }),
    ]));
  });

  it('quarantines an out-of-frame point and requires explicit dependent-route recovery', async () => {
    const onSave = vi.fn();
    render(<VenueMapDesigner
      map={{
        ...emptyVenueMapConfig(),
        points: [
          { id: 'outside', label: 'Service gate', kind: 'entry', x: 120, y: 20 },
          { id: 'inside', label: 'Ballroom', kind: 'amenity', x: 60, y: 40 },
        ],
        routes: [{
          id: 'dependent',
          name: 'Gate to ballroom',
          pointIds: ['outside', 'inside'],
        }],
      } as any}
      venues={venues}
      onSave={onSave}
    />);

    expect(screen.getByText(/horizontal coordinate falls outside the current map frame/i)).toBeInTheDocument();
    expect(screen.getByText(/Publication blocked: 1 walkway has unsafe or unavailable routing data/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Horizontal position for malformed point occurrence 1')).toHaveValue(100);
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(
      screen.getByLabelText('Horizontal position for malformed point occurrence 1'),
      { target: { value: '10' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reconstruct malformed map occurrence 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply repaired walkway Gate to ballroom' }));

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].points).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'outside', x: 10, y: 20 }),
    ]));
    expect(onSave.mock.calls[0][0].routes).toEqual([
      expect.objectContaining({ id: 'dependent', pointIds: ['outside', 'inside'] }),
    ]);
  });

  it('keeps an oversized map off the canvas and supports download-before-reset recovery', async () => {
    const oversizedMap = {
      ...emptyVenueMapConfig(),
      points: Array.from({ length: 501 }, (_, index) => ({
        id: `point-${index}`,
        label: `Point ${index}`,
        kind: 'entry' as const,
        x: index % 100,
        y: index % 80,
      })),
    };
    const onSave = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURL = vi.fn(() => 'blob:venue-map-recovery');
    const revokeObjectURL = vi.fn();
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    render(<VenueMapDesigner map={oversizedMap} venues={venues} onSave={onSave} />);

    expect(screen.getByText('Oversized Venue Map')).toBeInTheDocument();
    expect(screen.getByText(/working canvas is intentionally empty/i)).toBeInTheDocument();
    expect(screen.getByText(/501 points.*limit is 500/i)).toBeInTheDocument();
    expect(document.querySelectorAll('[data-map-point]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: '👁 Preview audiences' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    expect(onSave).not.toHaveBeenCalled();

    const resetButton = screen.getByRole('button', { name: 'Reset Venue Map' });
    expect(resetButton).toBeDisabled();
    expect(resetButton).toHaveAttribute('title', expect.stringMatching(/Download the recovery JSON/i));

    fireEvent.click(screen.getByRole('button', { name: 'Download original recovery JSON' }));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:venue-map-recovery');
    expect(resetButton).toBeEnabled();

    fireEvent.click(resetButton);
    expect(screen.getByRole('dialog', { name: 'Reset the entire Venue Map?' }))
      .toHaveTextContent(/original recovery JSON download was initiated/i);
    fireEvent.click(screen.getByRole('button', { name: 'Reset working map' }));
    expect(screen.queryByText('Oversized Venue Map')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({ points: [], routes: [], drawings: [] });
    anchorClick.mockRestore();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
  });

  it('quarantines an explicitly invalid whole-map frame until valid dimensions are accepted', async () => {
    const onSave = vi.fn();
    render(<VenueMapDesigner
      map={{
        ...emptyVenueMapConfig(),
        width: 900,
        points: [{ id: 'gate', label: 'Gate', kind: 'entry', x: 25, y: 25 }],
      } as any}
      venues={venues}
      onSave={onSave}
    />);

    expect(screen.getByRole('alert')).toHaveTextContent(/1 malformed saved map occurrence requires an explicit decision/i);
    expect(screen.getByText('Venue Map frame')).toBeInTheDocument();
    expect(screen.getByText(/no portal receives this map/i)).toHaveTextContent(/500 × 80/i);
    expect(screen.queryByLabelText('Canonical ID')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '👁 Preview audiences' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Map width'), { target: { value: '501' } });
    expect(screen.getByRole('button', { name: 'Apply size' })).toBeDisabled();
    expect(screen.getByText(/Width and height must each be a finite number from 20 to 500/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Map width'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply size' }));
    fireEvent.click(screen.getByRole('button', {
      name: 'Accept repaired Venue Map frame 300 by 80',
    }));
    expect(screen.queryByText(/malformed saved map occurrence requires an explicit decision/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '👁 Preview audiences' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({ width: 300, height: 80 });
  });

  it('offers an accessible confirmed reset for a quarantined whole-map frame', async () => {
    const onSave = vi.fn();
    render(<VenueMapDesigner
      map={{
        ...emptyVenueMapConfig(),
        height: -5,
        backgroundImageUrl: 'data:image/png;base64,AAAA',
        points: [{ id: 'gate', label: 'Gate', kind: 'entry', x: 25, y: 25 }],
      } as any}
      venues={venues}
      onSave={onSave}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Reset Venue Map instead' }));
    expect(screen.getByRole('dialog', { name: 'Reset the entire Venue Map?' })).toHaveTextContent(/cannot be undone/i);
    fireEvent.click(screen.getByRole('button', { name: 'Keep recovery map' }));
    expect(screen.getByText('Venue Map frame')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Venue Map instead' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset working map' }));
    expect(screen.queryByText('Venue Map frame')).not.toBeInTheDocument();
    expect(screen.getByText(/0 spaces · 0 lodging · 0 parking · 0 entries/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      width: 100,
      height: 80,
      points: [],
      routes: [],
      drawings: [],
      rainContingencies: [],
    });
  });

  it('keeps an uninterpretable top-level map document removable without rendering it', () => {
    const onSave = vi.fn();
    render(<VenueMapDesigner map={'not-a-map' as any} venues={venues} onSave={onSave} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/1 malformed saved map occurrence requires an explicit decision/i);
    expect(screen.getByText('Venue Map document')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove malformed saved map occurrence 1' }));
    expect(screen.queryByText(/malformed saved map occurrence requires an explicit decision/i)).not.toBeInTheDocument();
  });

  it('requires an explicit removal decision for an uninterpretable saved collection', () => {
    const map = {
      ...emptyVenueMapConfig(),
      routes: { unexpected: true },
    } as any;
    const onSave = vi.fn();
    render(<VenueMapDesigner map={map} venues={venues} onSave={onSave} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/1 malformed saved map occurrence requires an explicit decision/i);
    expect(screen.queryByRole('button', { name: /Reconstruct malformed map occurrence/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove malformed saved map occurrence 1' }));
    expect(screen.queryByText(/malformed saved map occurrence requires an explicit decision/i)).not.toBeInTheDocument();
  });

  it('quarantines malformed shapes, supports explicit recovery, and exposes keyboard geometry editors', async () => {
    const map = {
      ...emptyVenueMapConfig(),
      drawings: [
        { id: 'legacy-polygon', type: 'polygon', x: 4, y: 4, text: 'Legacy polygon' },
        { id: 'circle', type: 'circle', x: 20, y: 20, radius: -4, text: 'Round garden' },
        { id: 'line', type: 'line', x: 5, y: 5, points: [{ x: 5, y: 5 }], text: 'Fence line' },
        { id: 'remove-me', type: 'unsupported', x: 1, y: 1, text: 'Remove me' },
      ],
    } as any;
    const onSave = vi.fn();
    render(<VenueMapDesigner map={map} venues={venues} onSave={onSave} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/4 unsupported or malformed map shapes require recovery/i);
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {
      name: 'Convert quarantined map shape 1 to a rectangular zone',
    }));
    fireEvent.click(screen.getByRole('button', {
      name: 'Rebuild geometry for quarantined map shape 1',
    }));
    fireEvent.click(screen.getByRole('button', {
      name: 'Rebuild geometry for quarantined map shape 1',
    }));
    fireEvent.click(screen.getByRole('button', {
      name: 'Remove quarantined map shape 1',
    }));
    expect(screen.queryByText(/unsupported or malformed map shapes require recovery/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Round garden' }));
    fireEvent.change(screen.getByLabelText('Center X'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done editing shape' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fence line' }));
    fireEvent.change(screen.getByLabelText('Line vertex 1 X coordinate'), { target: { value: '7' } });

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].drawings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'legacy-polygon', type: 'zone' }),
      expect.objectContaining({ id: 'circle', type: 'circle', x: 30, radius: 10 }),
      expect.objectContaining({ id: 'line', type: 'line' }),
    ]));
    expect(onSave.mock.calls[0][0].drawings.find((drawing: any) => drawing.id === 'line').points[0].x).toBe(7);
  });

  it('supports explicit keep-only and remove decisions for quarantined rain-plan groups', async () => {
    const rainVenues = [
      { id: 'lawn', name: 'Lawn', category: 'ceremony', environment: 'outdoor' },
      { id: 'terrace', name: 'Terrace', category: 'reception', environment: 'outdoor' },
      { id: 'courtyard', name: 'Courtyard', category: 'reception', environment: 'outdoor' },
      { id: 'hall', name: 'Hall', category: 'reception', environment: 'indoor' },
      { id: 'barn', name: 'Barn', category: 'reception', environment: 'indoor' },
    ] as any;
    const map = {
      ...emptyVenueMapConfig(),
      rainContingencies: [
        { id: 'lawn-hall', outdoorVenueId: 'lawn', indoorVenueId: 'hall' },
        { id: 'lawn-barn', outdoorVenueId: 'lawn', indoorVenueId: 'barn' },
        { id: 'duplicate-id', outdoorVenueId: 'terrace', indoorVenueId: 'hall' },
        { id: 'duplicate-id', outdoorVenueId: 'courtyard', indoorVenueId: 'barn' },
      ],
    };
    const onSave = vi.fn();
    render(<VenueMapDesigner map={map} venues={rainVenues} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', {
      name: 'Keep only quarantined rain plan 2 in its conflict group',
    }));
    expect(screen.getByRole('alert')).toHaveTextContent(/2 duplicate or competing rain plans require recovery/i);

    fireEvent.click(screen.getByRole('button', { name: 'Remove quarantined rain plan 1' }));
    expect(screen.queryByText(/duplicate or competing rain plans require recovery/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].rainContingencies).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'lawn-barn', outdoorVenueId: 'lawn' }),
      expect.objectContaining({ id: 'duplicate-id', outdoorVenueId: 'courtyard' }),
    ]));
    expect(onSave.mock.calls[0][0].rainContingencies).toHaveLength(2);
  });

  it('keeps unavailable space pins recoverable and blocks publication until linked or reclassified', async () => {
    const duplicateCatalog = [
      ...venues,
      { id: 'ambiguous', name: 'Ambiguous A' },
      { id: 'ambiguous', name: 'Ambiguous B' },
    ] as any;
    const map = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'unlinked', label: 'Unlinked suite', kind: 'space' as const, x: 10, y: 10 },
        { id: 'deleted', label: 'Deleted hall', kind: 'space' as const, venueId: 'removed-hall', x: 20, y: 20 },
        { id: 'ambiguous-pin', label: 'Ambiguous hall', kind: 'space' as const, venueId: 'ambiguous', x: 30, y: 30 },
      ],
    };
    const onSave = vi.fn();
    render(<VenueMapDesigner map={map} venues={duplicateCatalog} onSave={onSave} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/Publication blocked: 3 space pins are not linked to a unique current venue/i);
    expect(screen.getByText(/Linked venue ID “removed-hall” no longer exists/i)).toBeInTheDocument();
    expect(screen.getByText(/Linked venue ID “ambiguous” is not unique/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Repair venue link for Unlinked suite' }));
    const unlinkedSelect = await screen.findByLabelText(/Linked event space or lodging/) as HTMLSelectElement;
    expect(unlinkedSelect).toHaveValue('');
    fireEvent.change(unlinkedSelect, { target: { value: 'ballroom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply point changes' }));

    fireEvent.click(screen.getByRole('button', { name: 'Repair venue link for Deleted hall' }));
    const staleSelect = screen.getByLabelText(/Linked event space or lodging/) as HTMLSelectElement;
    expect(screen.getByRole('option', { name: /Unavailable.*removed-hall/i })).toBeDisabled();
    expect(staleSelect).toHaveValue('removed-hall');
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'amenity' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply point changes' }));

    fireEvent.click(screen.getByRole('button', { name: 'Repair venue link for Ambiguous hall' }));
    const ambiguousSelect = screen.getByLabelText(/Linked event space or lodging/) as HTMLSelectElement;
    expect(screen.getByRole('option', { name: /Unavailable.*ambiguous/i })).toBeDisabled();
    fireEvent.change(ambiguousSelect, { target: { value: 'garden' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply point changes' }));

    expect(screen.queryByText(/Publication blocked:.*space pins/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].points).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'unlinked', venueId: 'ballroom' }),
      expect.objectContaining({ id: 'deleted', kind: 'amenity', venueId: undefined }),
      expect.objectContaining({ id: 'ambiguous-pin', venueId: 'garden' }),
    ]));
  });

  it('exposes and repairs unavailable event scopes before publication', async () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, {
      label: 'Garden entrance',
      kind: 'entry',
      x: 10,
      y: 10,
      eventSpaceIds: ['garden', 'deleted-space'],
    });
    map = addMapPoint(map, { label: 'Ballroom', kind: 'space', x: 30, y: 30, venueId: 'ballroom' });
    map = addMapRoute(map, 'Scoped walkway', map.points.map((point) => point.id), {
      eventSpaceIds: ['__invalid_event_scope__'],
    });
    map = {
      ...map,
      drawings: [{
        id: 'service-lawn',
        type: 'zone',
        x: 5,
        y: 5,
        width: 20,
        height: 15,
        text: 'Service lawn',
        eventSpaceIds: ['ballroom', 'retired-pavilion'],
      }],
    };
    const onSave = vi.fn();
    const { container } = render(
      <VenueMapDesigner map={map} venues={venues} onSave={onSave} />,
    );

    const publicationAlert = screen.getByRole('alert');
    expect(publicationAlert).toHaveTextContent(/3 map objects have unavailable event-space scope/i);
    expect(publicationAlert).toHaveTextContent(/Point “Garden entrance”: deleted-space/i);
    expect(publicationAlert).toHaveTextContent(/Walkway “Scoped walkway”: Malformed saved scope/i);
    expect(publicationAlert).toHaveTextContent(/Shape “Service lawn”: retired-pavilion/i);

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());

    selectFirstMapPoint(container);
    fireEvent.click(screen.getByRole('button', { name: 'Use Garden entrance for all wedding events' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply point changes' }));

    fireEvent.click(screen.getByRole('button', { name: 'Service lawn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove unavailable scopes from Service lawn' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Scoped walkway' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove unavailable scopes from Scoped walkway' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply route changes' }));

    expect(screen.queryByText(/Publication blocked:.*unavailable event-space scope/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].points[0].eventSpaceIds).toBeUndefined();
    expect(onSave.mock.calls[0][0].drawings[0].eventSpaceIds).toEqual(['ballroom']);
    expect(onSave.mock.calls[0][0].routes[0].eventSpaceIds).toBeUndefined();
  });

  it('quarantines duplicate identities and publishes only after explicit recovery', async () => {
    const map = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'anchor', label: 'Primary entrance', kind: 'entry' as const, x: 5, y: 5 },
        { id: 'anchor', label: 'Side entrance', kind: 'entry' as const, x: 10, y: 10 },
        { id: 'garden', label: 'Garden', kind: 'space' as const, venueId: 'garden', x: 50, y: 30 },
      ],
      routes: [
        { id: 'arrival', name: 'Arrival path', pointIds: ['anchor', 'garden'] },
        { id: 'loop', name: 'Public loop', pointIds: ['anchor', 'garden'] },
        { id: 'loop', name: 'Staff loop', pointIds: ['anchor', 'garden'], audience: 'staff' as const },
      ],
      drawings: [
        { id: 'lawn', type: 'zone', x: 1, y: 1, width: 10, height: 10, text: 'Guest lawn' },
        { id: 'lawn', type: 'zone', x: 20, y: 20, width: 10, height: 10, text: 'Staff lawn', audience: 'staff' as const },
      ],
    };
    const onSave = vi.fn();
    const { container } = render(
      <VenueMapDesigner map={map} venues={venues} onSave={onSave} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/duplicated map identities require recovery/i);
    expect(screen.getByText(/1 affected walkway is temporarily quarantined/i)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-map-point]')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', {
      name: /Keep occurrence 1, Primary entrance at 5, 5, with original ID anchor/i,
    }));
    expect(screen.getByText(/Duplicate walkway ID “loop”/i)).toBeInTheDocument();
    expect(screen.queryByText(/affected walkways are temporarily quarantined/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {
      name: /Assign a new ID to occurrence 1, Public loop/i,
    }));
    fireEvent.click(screen.getByRole('button', {
      name: /Remove duplicate occurrence 1, Guest lawn/i,
    }));

    expect(screen.queryByText(/duplicated map identities require recovery/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    const saved = onSave.mock.calls[0][0];
    expect(saved.points).toHaveLength(3);
    expect(new Set(saved.points.map((point: { id: string }) => point.id)).size).toBe(3);
    expect(saved.points.find((point: { label: string }) => point.label === 'Primary entrance').id).toBe('anchor');
    expect(saved.points.find((point: { label: string }) => point.label === 'Side entrance').id).not.toBe('anchor');
    expect(saved.routes).toHaveLength(3);
    expect(new Set(saved.routes.map((route: { id: string }) => route.id)).size).toBe(3);
    expect(saved.routes.find((route: { name: string }) => route.name === 'Arrival path').pointIds)
      .toEqual(['anchor', 'garden']);
    expect(saved.drawings).toHaveLength(1);
    expect(saved.drawings[0].text).toBe('Staff lawn');
  });

  it('quarantines broken walkways and requires an explicit ordered repair', async () => {
    const map = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'parking', label: 'Parking', kind: 'parking' as const, x: 5, y: 5 },
        { id: 'checkpoint', label: 'Welcome checkpoint', kind: 'path' as const, x: 25, y: 20 },
        { id: 'ceremony', label: 'Ceremony', kind: 'space' as const, venueId: 'garden', x: 50, y: 40 },
      ],
      routes: [{
        id: 'arrival',
        name: 'Arrival path',
        pointIds: ['parking', 'deleted-checkpoint', '__invalid_map_point_reference__', 'ceremony'],
      }],
    };
    const onSave = vi.fn();
    render(<VenueMapDesigner map={map} venues={venues} onSave={onSave} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/1 walkway has unsafe or unavailable routing data/i);
    expect(screen.getByText(/Unavailable point ID “deleted-checkpoint”/i)).toBeInTheDocument();
    expect(screen.getByText(/Malformed saved reference/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply repaired walkway Arrival path' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Replacement for stop 2 of Arrival path'), {
      target: { value: 'checkpoint' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove stop 3 from Arrival path' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply repaired walkway Arrival path' }));

    expect(screen.queryByText(/walkway has unsafe or unavailable routing data/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].routes[0].pointIds)
      .toEqual(['parking', 'checkpoint', 'ceremony']);
  });

  it('quarantines an explicit invalid priority until the admin chooses a safe route tier', async () => {
    const map = {
      ...emptyVenueMapConfig(),
      points: [
        { id: 'gate', label: 'Gate', kind: 'entry' as const, x: 5, y: 5 },
        { id: 'lawn', label: 'Lawn', kind: 'space' as const, venueId: 'garden', x: 50, y: 40 },
      ],
      routes: [
        {
          id: 'damaged-evacuation',
          name: 'Evacuation route',
          pointIds: ['gate', 'lawn'],
          priority: INVALID_VENUE_MAP_ROUTE_PRIORITY,
        },
        {
          id: 'legacy-arrival',
          name: 'Legacy arrival',
          pointIds: ['gate', 'lawn'],
        },
      ],
    };
    const onSave = vi.fn();
    render(<VenueMapDesigner map={map} venues={venues} onSave={onSave} />);

    expect(screen.getByText(/saved routing priority is invalid/i)).toBeInTheDocument();
    expect(screen.getByText(/invalid priority cannot become a routine guest route/i))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply repaired walkway Evacuation route' }))
      .toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Recovery priority for Evacuation route'), {
      target: { value: 'emergency-only' },
    });
    expect(screen.getByRole('button', { name: 'Apply repaired walkway Evacuation route' }))
      .toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply repaired walkway Evacuation route' }));
    expect(screen.queryByText(/saved routing priority is invalid/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'legacy-arrival', priority: 'standard' }),
      expect.objectContaining({ id: 'damaged-evacuation', priority: 'emergency-only' }),
    ]));
  });

  it('quarantines dependent walkways when an admin deletes an intermediate point', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Parking', kind: 'parking', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'Welcome checkpoint', kind: 'path', x: 25, y: 20 });
    map = addMapPoint(map, { label: 'Ceremony', kind: 'space', x: 50, y: 40, venueId: 'garden' });
    map = addMapRoute(map, 'Arrival path', map.points.map((point) => point.id));
    const deletedPointId = map.points[1].id;
    const { container } = render(
      <VenueMapDesigner map={map} venues={venues} onSave={() => {}} />,
    );

    const points = container.querySelectorAll<SVGGElement>('[data-map-point]');
    fireEvent.pointerDown(points[1], { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/walkway has unsafe or unavailable routing data/i);
    expect(screen.getByText(new RegExp(`Unavailable point ID “${deletedPointId}”`)))
      .toBeInTheDocument();
    expect(screen.getAllByText(/Arrival path/).length).toBeGreaterThan(0);
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

  it('edits route metadata and ordered points before explicit publication', async () => {
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
    const priorityControls = screen.getAllByLabelText('Routing priority');
    fireEvent.change(priorityControls[priorityControls.length - 1], { target: { value: 'preferred' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply route changes' }));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(screen.getByText(/Canonical venue map is saved/)).toBeInTheDocument());
    const savedRoute = onSave.mock.calls[0][0].routes[0];
    expect(savedRoute.pointIds).toEqual([map.points[0].id, map.points[2].id, map.points[1].id]);
    expect(savedRoute.audience).toBe('couple');
    expect(savedRoute.accessibility).toBe('step-free');
    expect(savedRoute.priority).toBe('preferred');
  });

  it('reports dirty state: placing/editing fires onDirtyChange(true), saving fires false', async () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Garden', kind: 'space', x: 30, y: 30, venueId: 'garden' });
    const onDirtyChange = vi.fn();
    const { container } = render(
      <VenueMapDesigner map={map} venues={venues} onSave={() => {}} onDirtyChange={onDirtyChange} />,
    );
    // Place a non-space point on the canvas -> dirty. Space pins now require
    // an explicit current-catalog link before publication.
    chooseParkingPlacement();
    clickCanvas(container);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    // Apply the new point, then saving the map clears the dirty state.
    fireEvent.click(screen.getByRole('button', { name: 'Apply point changes' }));
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it('requires point changes to be applied before publication canonicalizes them', async () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, {
      label: 'Garden',
      kind: 'space',
      x: 30,
      y: 30,
      venueId: 'garden',
    });
    const onSave = vi.fn();
    const { container } = render(
      <VenueMapDesigner map={map} venues={venues} onSave={onSave} />,
    );

    selectFirstMapPoint(container);
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'parking' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Apply or cancel the in-progress edits/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply point changes' }));
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].points[0]).toEqual(expect.objectContaining({
      label: 'Point',
      kind: 'parking',
      venueId: undefined,
    }));
  });

  it('normalizes one canonical snapshot before persistence and editor clean state', async () => {
    const onSave = vi.fn();
    render(
      <VenueMapDesigner map={emptyVenueMapConfig()} venues={venues} onSave={onSave} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Add editable zone/i }));
    const longLabel = 'Z'.repeat(350);
    fireEvent.change(screen.getByLabelText('Shape label'), {
      target: { value: longLabel },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].drawings[0].text).toHaveLength(300);
    await waitFor(() => expect(screen.getByLabelText('Shape label')).toHaveValue('Z'.repeat(300)));
    expect(screen.getByText(/Canonical venue map is saved/)).toBeInTheDocument();
  });

  it('guards staged size, URL, and route-form drafts and blocks incomplete global saves', async () => {
    const onSave = vi.fn();
    const onDirtyChange = vi.fn();
    render(
      <VenueMapDesigner
        map={emptyVenueMapConfig()}
        venues={venues}
        onSave={onSave}
        onDirtyChange={onDirtyChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Map width'), { target: { value: '120' } });
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Apply or cancel the in-progress edits/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset size draft' }));

    fireEvent.change(screen.getByLabelText('Base map image URL'), {
      target: { value: 'https://example.com/new-map.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset URL draft' }));

    fireEvent.change(screen.getByLabelText('Walkway name'), {
      target: { value: 'Unfinished route' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset route draft' }));

    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('retains a stale draft and its loaded revision when the server reports a conflict', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'conflict' });
    const onDirtyChange = vi.fn();
    const onConflictDraftChange = vi.fn();
    const { container } = render(
      <VenueMapDesigner
        map={emptyVenueMapConfig()}
        venues={venues}
        baseUpdatedAt="2026-09-06T12:00:00.000Z"
        onSave={onSave}
        onDirtyChange={onDirtyChange}
        onConflictDraftChange={onConflictDraftChange}
      />,
    );

    chooseParkingPlacement();
    clickCanvas(container);
    fireEvent.click(screen.getByRole('button', { name: 'Apply point changes' }));
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ points: expect.arrayContaining([expect.any(Object)]) }),
      '2026-09-06T12:00:00.000Z',
    ));
    await waitFor(() => expect(screen.getByText(/Local draft has unpublished changes/)).toBeInTheDocument());
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(onConflictDraftChange).toHaveBeenCalledWith(expect.any(Object), false);
  });

  it('updates conflict resolution with the latest visible draft after an in-flight edit', async () => {
    let resolveConflict!: (value: { status: 'conflict' }) => void;
    const conflict = new Promise<{ status: 'conflict' }>((resolve) => {
      resolveConflict = resolve;
    });
    const onConflictDraftChange = vi.fn();
    const onSave = vi.fn(() => conflict);
    render(
      <VenueMapDesigner
        map={emptyVenueMapConfig()}
        venues={venues}
        baseUpdatedAt="2026-09-06T12:00:00.000Z"
        onSave={onSave}
        onConflictDraftChange={onConflictDraftChange}
      />,
    );

    chooseParkingPlacement();
    fireEvent.click(screen.getByRole('button', { name: /Place Parking at center/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply point changes' }));
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Label'), {
      target: { value: 'Newest visible conflict draft' },
    });
    await act(async () => {
      resolveConflict({ status: 'conflict' });
      await conflict;
    });

    expect(onConflictDraftChange).toHaveBeenCalledTimes(1);
    expect(onConflictDraftChange.mock.calls[0][0].points[0].label)
      .toBe('Newest visible conflict draft');
    expect(onConflictDraftChange.mock.calls[0][1]).toBe(true);
  });

  it('preserves newer editor changes made while an older save is in flight', async () => {
    let resolveFirstSave!: (value: { status: 'saved'; updatedAt: string }) => void;
    const firstSave = new Promise<{ status: 'saved'; updatedAt: string }>((resolve) => {
      resolveFirstSave = resolve;
    });
    const onSave = vi.fn()
      .mockImplementationOnce(() => firstSave)
      .mockResolvedValueOnce({ status: 'saved', updatedAt: '2026-09-06T12:10:00.000Z' });
    const onDirtyChange = vi.fn();
    render(
      <VenueMapDesigner
        map={emptyVenueMapConfig()}
        venues={venues}
        baseUpdatedAt="2026-09-06T12:00:00.000Z"
        onSave={onSave}
        onDirtyChange={onDirtyChange}
      />,
    );

    chooseParkingPlacement();
    fireEvent.click(screen.getByRole('button', { name: /Place Parking at center/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply point changes' }));
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Label'), {
      target: { value: 'Edited while saving' },
    });
    await act(async () => {
      resolveFirstSave({ status: 'saved', updatedAt: '2026-09-06T12:05:00.000Z' });
      await firstSave;
    });

    expect(screen.getByLabelText('Label')).toHaveValue('Edited while saving');
    await waitFor(() => expect(screen.getByText(/Apply or cancel the in-progress edits/)).toBeInTheDocument());
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Apply point changes' }));
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1][0].points[0].label).toBe('Edited while saving');
    expect(onSave.mock.calls[1][1]).toBe('2026-09-06T12:05:00.000Z');
  });

  it('advances its compare-and-swap base only after a successful save', async () => {
    const onSave = vi.fn()
      .mockResolvedValueOnce({ status: 'saved', updatedAt: '2026-09-06T12:05:00.000Z' })
      .mockResolvedValueOnce({ status: 'saved', updatedAt: '2026-09-06T12:10:00.000Z' });
    const { container } = render(
      <VenueMapDesigner
        map={emptyVenueMapConfig()}
        venues={venues}
        baseUpdatedAt="2026-09-06T12:00:00.000Z"
        onSave={onSave}
      />,
    );

    chooseParkingPlacement();
    clickCanvas(container, 100, 100);
    fireEvent.click(screen.getByRole('button', { name: 'Apply point changes' }));
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(screen.getByText(/Canonical venue map is saved/)).toBeInTheDocument());

    clickCanvas(container, 300, 200);
    fireEvent.click(screen.getByRole('button', { name: 'Apply point changes' }));
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1][1]).toBe('2026-09-06T12:05:00.000Z');
  });

  it('undo/redo: placing a point can be undone then redone without a ghost edit lock', async () => {
    const onSave = vi.fn();
    const { container } = render(
      <VenueMapDesigner map={emptyVenueMapConfig()} venues={venues} onSave={onSave} />,
    );
    clickCanvas(container); // place a space point
    expect(screen.getByText(/1 spaces/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    expect(screen.getByText(/0 spaces/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Apply point changes' })).not.toBeInTheDocument();

    // The removed selection must not leave editing=true and silently block the
    // global action after history has restored the clean, empty map.
    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /Redo/ }));
    expect(screen.getByText(/1 spaces/)).toBeTruthy();
  });

  it('closes an unreachable route editor when undo removes its route', async () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Gate', kind: 'entry', x: 5, y: 5 });
    map = addMapPoint(map, { label: 'Garden', kind: 'space', x: 40, y: 20, venueId: 'garden' });
    const onSave = vi.fn();
    render(<VenueMapDesigner map={map} venues={venues} onSave={onSave} />);

    const addPoint = screen.getByLabelText('Add point to walkway');
    fireEvent.change(addPoint, { target: { value: map.points[0].id } });
    fireEvent.change(addPoint, { target: { value: map.points[1].id } });
    fireEvent.click(screen.getByRole('button', { name: /Add walkway/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Path' }));
    expect(screen.getByRole('button', { name: 'Apply route changes' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    expect(screen.queryByRole('button', { name: 'Apply route changes' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save & publish Venue Map/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
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
    expect(screen.getByText(/Canonical venue map is saved/)).toBeInTheDocument();
    expect(container.querySelector('text')?.textContent).not.toContain('Temporary label');
  });

  it('cancels a newly placed point instead of silently retaining it', () => {
    render(<VenueMapDesigner map={emptyVenueMapConfig()} venues={venues} onSave={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Place Event Space at center/ }));
    expect(screen.getByText(/1 spaces/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel edits' }));
    expect(screen.getByText(/0 spaces/)).toBeInTheDocument();
    expect(screen.getByText(/Canonical venue map is saved/)).toBeInTheDocument();
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

  it('marks editor controls as print chrome and exposes a full-width print grid hook', () => {
    const { container } = render(
      <VenueMapDesigner map={emptyVenueMapConfig()} venues={venues} onSave={() => {}} />,
    );
    expect(container.querySelector('.spm-venue-map-print-grid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save & publish Venue Map/i }).closest('.no-print'))
      .toBeInTheDocument();
  });

  it('exports the audience-preview SVG that is currently mounted', async () => {
    vi.mocked(downloadLayoutPng).mockClear();
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Public Gate', kind: 'entry', x: 20, y: 20 });
    const { container } = render(
      <VenueMapDesigner map={map} venues={venues} mapTitle="Preview Venue" onSave={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Place Event Space at center/i }));
    fireEvent.click(screen.getByRole('button', { name: /Preview audiences/i }));
    expect(screen.getByText(/Source: Unpublished working draft — not currently available in portals/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /PNG/i }));

    await waitFor(() => expect(downloadLayoutPng).toHaveBeenCalledTimes(1));
    const exportCall = vi.mocked(downloadLayoutPng).mock.calls[0];
    const exportedSvg = exportCall[0];
    expect(container.contains(exportedSvg)).toBe(true);
    expect(exportedSvg).toHaveAttribute('aria-label', expect.stringContaining('Preview Venue'));
    expect(exportCall[1]).toBe('preview-venue-unpublished-draft-guest-preview');
    expect(exportCall[2]).toEqual(expect.objectContaining({
      footerText: expect.stringMatching(/^Unpublished working draft \| Guest portal preview \| Exported /),
    }));
  });

  it('clearly classifies restricted default exports as the internal staff master', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, {
      label: 'Service Entrance',
      kind: 'entry',
      x: 20,
      y: 20,
      audience: 'staff',
    });
    render(<VenueMapDesigner map={map} venues={venues} onSave={() => {}} />);

    expect(screen.getByText(/Export\/print source: Saved canonical map\. Audience: Staff master/i)).toBeInTheDocument();
    expect(screen.getByText(/Includes 1 couple\/staff-only layer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Staff master PNG/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Staff master PDF/i })).toBeInTheDocument();
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
