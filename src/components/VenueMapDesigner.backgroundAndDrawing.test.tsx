import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueMapDesigner } from './VenueMapDesigner';
import { emptyVenueMapConfig } from '../services/wayfinding/venueWayfindingService';

const mockVenues: any[] = [
  { id: 'v1', name: 'Grand Ballroom', category: 'reception' },
  { id: 'v2', name: 'Rose Garden', category: 'ceremony' },
];

describe('VenueMapDesigner base image and map-native zones', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders canonical base-map and zone controls and applies a valid HTTPS image URL to the draft', () => {
    const map = emptyVenueMapConfig();
    const { container } = render(<VenueMapDesigner map={map} venues={mockVenues} onSave={() => {}} />);

    expect(screen.getByText('🖼️ Base Map Image')).toBeInTheDocument();
    expect(screen.getByText('🎨 Property zones')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('https://example.com/property-aerial.png'), {
      target: { value: 'https://example.com/map.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(container.querySelector('image')).toHaveAttribute('href', 'https://example.com/map.png');
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText(/Local draft has unpublished changes/)).toBeInTheDocument();
  });

  it('adds one editable vector zone with audience and event-space controls, then clears it', () => {
    render(<VenueMapDesigner map={emptyVenueMapConfig()} venues={mockVenues} onSave={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Add editable zone/i }));
    expect(screen.getByDisplayValue('New map zone')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Zone label'), { target: { value: 'Ceremony Lawn' } });
    const audienceControls = screen.getAllByLabelText('Audience');
    fireEvent.change(audienceControls[audienceControls.length - 1], { target: { value: 'couple' } });
    expect(screen.getAllByText('Ceremony Lawn').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Couples only').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Event-space scope: All wedding events/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Clear zones/i }));
    expect(screen.queryByDisplayValue('Ceremony Lawn')).not.toBeInTheDocument();
  });

  it('accepts a bounded raster upload without fabricating a success reference', async () => {
    const { container } = render(<VenueMapDesigner map={emptyVenueMapConfig()} venues={mockVenues} onSave={() => {}} />);
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'property.png', { type: 'image/png' });

    fireEvent.change(screen.getByLabelText('Upload base map image file'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(container.querySelector('image')).toBeInTheDocument());
    expect(container.querySelector('image')?.getAttribute('href')).toMatch(/^data:image\/png;base64,/);
    expect(container.querySelector('image')?.getAttribute('href')).not.toContain('mock_basemap');
  });

  it('rejects unsafe upload formats without changing the map', () => {
    const { container } = render(<VenueMapDesigner map={emptyVenueMapConfig()} venues={mockVenues} onSave={() => {}} />);
    const file = new File(['<svg><script>alert(1)</script></svg>'], 'unsafe.svg', { type: 'image/svg+xml' });

    fireEvent.change(screen.getByLabelText('Upload base map image file'), {
      target: { files: [file] },
    });

    expect(container.querySelector('image')).not.toBeInTheDocument();
    expect(screen.getByText(/Venue map is saved/)).toBeInTheDocument();
  });

  it('keeps the base image separate when zones are edited and saves only through the explicit map action', () => {
    const onSave = vi.fn();
    const map = {
      ...emptyVenueMapConfig(),
      backgroundImageUrl: 'data:image/png;base64,public-safe-map',
    };
    render(<VenueMapDesigner map={map} venues={mockVenues} onSave={onSave} />);

    expect(screen.queryByRole('button', { name: /Drawing Studio/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add editable zone/i }));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Save Venue Map/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].backgroundImageUrl).toBe('data:image/png;base64,public-safe-map');
    expect(onSave.mock.calls[0][0].drawings).toHaveLength(1);
  });
});
