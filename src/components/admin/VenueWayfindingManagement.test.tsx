import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VenueWayfindingManagement } from './VenueWayfindingManagement';
import { emptyVenueMapConfig, saveVenueMapConfig } from '../../services/wayfinding/venueWayfindingService';
import { addMapPoint, addMapRoute } from '../../utils/venueMapDesigner';

const venues = [
  { id: 'ballroom', name: 'Grand Ballroom', width: 80, height: 60, capacity: 250, category: 'reception' },
  { id: 'garden', name: 'Garden', width: 100, height: 80, capacity: 150, category: 'outdoor' },
] as any;

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

  it('shows map summary counts from the saved config', () => {
    let map = emptyVenueMapConfig();
    map = addMapPoint(map, { label: 'Grand Ballroom', kind: 'space', x: 20, y: 20, venueId: 'ballroom' });
    map = addMapPoint(map, { label: 'Parking', kind: 'parking', x: 80, y: 10 });
    map = addMapPoint(map, { label: 'Entry', kind: 'entry', x: 5, y: 5 });
    map = addMapRoute(map, 'Main Walkway', map.points.map((p) => p.id));
    saveVenueMapConfig(map);

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
});
