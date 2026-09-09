import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { VenueWayfindingManagement } from './VenueWayfindingManagement';
import {
  cacheVenueMapConfigFromServer,
  emptyVenueMapConfig,
  saveVenueMapConfig,
} from '../../services/wayfinding/venueWayfindingService';
import { addMapPoint, addMapRoute } from '../../utils/venueMapDesigner';

const venues = [
  { id: 'ballroom', name: 'Grand Ballroom', width: 80, height: 60, capacity: 250, category: 'reception' },
  { id: 'garden', name: 'Garden', width: 100, height: 80, capacity: 150, category: 'outdoor' },
] as any;

async function flushQueuedDataEvents(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

const config = {
  venueName: 'Seven Paths Manor',
  tagline: '',
  location: '',
  websiteUrl: '',
  supportEmail: '',
  primaryColor: '#4A1942',
  primaryDark: '#3b1435',
  primaryLight: '#6a2a5e',
  accentColor: '#0d9488',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  headerTextColor: '#ffffff',
  bodyTextColor: '#374151',
  accentTextColor: '#0d9488',
  fontFamily: '',
  headingFontFamily: '',
} as any;

describe('VenueWayfindingManagement (admin)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('offers an "Open map designer" button that routes to the Studio module when provided', () => {
    const onOpenVenueMap = vi.fn();
    render(
      <VenueWayfindingManagement
        config={config}
        venues={venues}
        onShowSuccess={vi.fn()}
        onOpenVenueMap={onOpenVenueMap}
      />,
    );
    const btn = screen.getByRole('button', { name: /Open map designer/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onOpenVenueMap).toHaveBeenCalledTimes(1);
  });

  it('hides the open-map button when onOpenVenueMap is undefined', () => {
    render(
      <VenueWayfindingManagement
        config={config}
        venues={venues}
        onShowSuccess={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Open map designer/i })).toBeNull();
  });

  it('shows map summary counts from the saved config', async () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Grand Ballroom', kind: 'space', x: 20, y: 20, venueId: 'ballroom' });
    map = addMapPoint(map, { label: 'Parking', kind: 'parking', x: 80, y: 10 });
    map = addMapPoint(map, { label: 'Entry', kind: 'entry', x: 5, y: 5 });
    map = addMapRoute(map, 'Main Walkway', map.points.map((p) => p.id));
    saveVenueMapConfig(map);
    await flushQueuedDataEvents();

    render(
      <VenueWayfindingManagement
        config={config}
        venues={venues}
        onShowSuccess={vi.fn()}
      />,
    );
    // Summary tiles
    expect(screen.getByText('Spaces')).toBeTruthy();
    expect(screen.getByText('Parking')).toBeTruthy();
    expect(screen.getByText('Entries')).toBeTruthy();
    expect(screen.getByText('Walkways')).toBeTruthy();
    // The Full-Venue Map section headline exists
    expect(screen.getByText('🗺️ Full-Venue Map')).toBeTruthy();
  });

  it('shows rain contingencies read-only and routes management to the protected map designer', async () => {
    const contingencyVenues = [
      { id: 'garden', name: 'Garden', category: 'ceremony', environment: 'outdoor' },
      { id: 'ballroom', name: 'Ballroom', category: 'reception', environment: 'indoor' },
    ] as any;
    const map = {
      ...emptyVenueMapConfig(),
      rainContingencies: [{
        id: 'rain-garden',
        outdoorVenueId: 'garden',
        indoorVenueId: 'ballroom',
      }],
    };
    saveVenueMapConfig(map);
    await flushQueuedDataEvents();
    const onOpenVenueMap = vi.fn();

    render(
      <VenueWayfindingManagement
        config={config}
        venues={contingencyVenues}
        onShowSuccess={vi.fn()}
        onOpenVenueMap={onOpenVenueMap}
      />,
    );

    expect(screen.getByText('Garden')).toBeInTheDocument();
    expect(screen.getByText('Ballroom')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add backup/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Outdoor space/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Manage in map designer/i }));
    expect(onOpenVenueMap).toHaveBeenCalledTimes(1);
  });

  it('surfaces admin-only structural recovery instead of silently presenting an incomplete map', () => {
    cacheVenueMapConfigFromServer({
      ...emptyVenueMapConfig(),
      points: [{ label: 'Missing identity', kind: 'entry', x: 1, y: 1 }],
    });

    render(
      <VenueWayfindingManagement
        config={config}
        venues={venues}
        onShowSuccess={vi.fn()}
        onOpenVenueMap={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Publication blocked: 1 malformed saved map occurrence needs an explicit reconstruct\/remove decision/i);
  });

  it('flags colliding rain plans as quarantined instead of presenting one as canonical', () => {
    cacheVenueMapConfigFromServer({
      ...emptyVenueMapConfig(),
      rainContingencies: [
        { id: 'garden-hall', outdoorVenueId: 'garden', indoorVenueId: 'ballroom' },
        { id: 'garden-barn', outdoorVenueId: 'garden', indoorVenueId: 'barn' },
      ],
    });

    render(
      <VenueWayfindingManagement
        config={config}
        venues={venues}
        onShowSuccess={vi.fn()}
        onOpenVenueMap={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Publication blocked: 2 duplicate or competing rain plans require recovery/i);
    expect(screen.getByText(/No unconflicted rain-contingency backups are currently publishable/i)).toBeInTheDocument();
  });

  it('does not expose an independent rain-backup writer when the designer link is unavailable', () => {
    render(
      <VenueWayfindingManagement
        config={config}
        venues={venues}
        onShowSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText(/Rain backups are published with the full Venue Map/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Manage in map designer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add backup/i })).not.toBeInTheDocument();
  });
});
