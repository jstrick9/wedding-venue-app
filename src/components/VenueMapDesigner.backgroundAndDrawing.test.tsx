import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VenueMapDesigner } from './VenueMapDesigner';
import { emptyVenueMapConfig } from '../services/wayfinding/venueWayfindingService';

const mockVenues: any[] = [
  { id: 'v1', name: 'Grand Ballroom', category: 'reception' },
  { id: 'v2', name: 'Rose Garden', category: 'ceremony' },
];

describe('VenueMapDesigner - Base Map Background & Full Drawing Integration (#171)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Base Map and Drawing & Zones controls and allows base map URL application', () => {
    const onSave = vi.fn();
    const map = emptyVenueMapConfig();
    render(<VenueMapDesigner map={map} venues={mockVenues} onSave={onSave} />);

    expect(screen.getByText('🖼️ Base Map Image')).toBeInTheDocument();
    expect(screen.getByText('🎨 Map Drawing & Zones')).toBeInTheDocument();

    // Paste Base Map URL and apply
    const urlInput = screen.getByPlaceholderText('https://example.com/property-aerial.png');
    fireEvent.change(urlInput, { target: { value: 'https://example.com/map.png' } });
    const applyBtn = screen.getByRole('button', { name: 'Apply' });
    fireEvent.click(applyBtn);

    expect(screen.getByText('85% opacity')).toBeInTheDocument();
  });

  it('allows adding 4 Preset Zones to map.drawings and clearing them', () => {
    const onSave = vi.fn();
    const map = emptyVenueMapConfig();
    render(<VenueMapDesigner map={map} venues={mockVenues} onSave={onSave} />);

    const addZonesBtn = screen.getByRole('button', { name: /＋ Add 4 Preset Zones/i });
    fireEvent.click(addZonesBtn);

    // Verify shapes appeared in the side panel list
    expect(screen.getAllByText(/Ceremony Lawn Zone/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Main Parking Lot/i).length).toBeGreaterThan(0);

    // Clear shapes
    const clearBtn = screen.getByRole('button', { name: /Clear Shapes/i });
    fireEvent.click(clearBtn);

    expect(screen.queryByText(/Ceremony Lawn Zone/i)).not.toBeInTheDocument();
  });

  it('opens Full Map Drawing Studio modal when button is clicked', () => {
    const onSave = vi.fn();
    const map = emptyVenueMapConfig();
    render(<VenueMapDesigner map={map} venues={mockVenues} onSave={onSave} />);

    const openDrawingBtn = screen.getByRole('button', { name: /✏️ Open Full Map Drawing Studio/i });
    fireEvent.click(openDrawingBtn);

    // Verify DrawingTool modal opened
    expect(screen.getByText('Drawing Tools')).toBeInTheDocument();
  });
});
