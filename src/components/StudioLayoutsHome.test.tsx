import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioLayoutsHome } from './StudioLayoutsHome';
import type { Venue, LayoutTemplate, LayoutCategoryInfo } from '../types';

const venues: Venue[] = [
  {
    id: 'v1',
    name: 'Grand Ballroom',
    width: 60,
    height: 40,
    capacity: 220,
    category: 'reception',
  },
  {
    id: 'v2',
    name: 'Garden',
    width: 80,
    height: 50,
    capacity: 150,
    category: 'outdoor',
    masterLayout: {
      tables: [
        {
          id: 't1',
          type: 'table',
          specId: 'spec1',
          x: 0,
          y: 0,
          rotation: 0,
          label: 'T1',
          guests: [],
        },
      ],
      fixtures: [],
      decor: [],
      savedAt: '2026-07-01T12:00:00Z',
    },
  },
];

const templates: LayoutTemplate[] = [
  {
    id: 'tmpl1',
    name: 'Classic Round Setup',
    category: 'reception',
    venueId: 'v1',
    tables: [],
    fixtures: [],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'tmpl2',
    name: 'Garden Ceremony',
    category: 'outdoor',
    venueId: 'v2',
    tables: [],
    fixtures: [],
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const categories: LayoutCategoryInfo[] = [
  { id: 'reception', name: 'Reception', description: 'Reception', icon: '🪑', color: '#9333ea' },
  { id: 'outdoor', name: 'Outdoor', description: 'Outdoor', icon: '🌿', color: '#16a34a' },
];

describe('StudioLayoutsHome', () => {
  it('renders all venue spaces with capacity and master-layout status', () => {
    render(
      <StudioLayoutsHome
        venues={venues}
        currentVenueId="v1"
        templates={templates}
        layoutCategories={categories}
        canEdit
        onOpenVenue={vi.fn()}
        onSelectTemplate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Grand Ballroom')).toBeTruthy();
    expect(screen.getByText('Garden')).toBeTruthy();
    // Current space badge
    expect(screen.getByText('Open now')).toBeTruthy();
    // Master-layout status badges
    expect(screen.getByText('✓ Master saved')).toBeTruthy();
    expect(screen.getAllByText('No master').length).toBeGreaterThan(0);
    // Capacity summary (220 + 150)
    expect(screen.getByText('370')).toBeTruthy();
  });

  it('calls onOpenVenue when opening a space in the editor', () => {
    const onOpenVenue = vi.fn();
    render(
      <StudioLayoutsHome
        venues={venues}
        currentVenueId="v1"
        templates={templates}
        layoutCategories={categories}
        canEdit
        onOpenVenue={onOpenVenue}
        onSelectTemplate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const openButton = screen.getByRole('button', { name: 'Open in editor' }); // Garden (only non-current space)
    fireEvent.click(openButton);
    expect(onOpenVenue).toHaveBeenCalledWith('v2');
  });

  it('filters the template gallery by category', () => {
    render(
      <StudioLayoutsHome
        venues={venues}
        currentVenueId="v1"
        templates={templates}
        layoutCategories={categories}
        canEdit
        onOpenVenue={vi.fn()}
        onSelectTemplate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Classic Round Setup')).toBeTruthy();
    expect(screen.getByText('Garden Ceremony')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Outdoor/ }));
    expect(screen.queryByText('Classic Round Setup')).toBeNull();
    expect(screen.getByText('Garden Ceremony')).toBeTruthy();
  });

  it('calls onSelectTemplate when a template is chosen', () => {
    const onSelectTemplate = vi.fn();
    render(
      <StudioLayoutsHome
        venues={venues}
        currentVenueId="v1"
        templates={templates}
        layoutCategories={categories}
        canEdit
        onOpenVenue={vi.fn()}
        onSelectTemplate={onSelectTemplate}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Classic Round Setup/ }));
    expect(onSelectTemplate).toHaveBeenCalledWith(templates[0]);
  });
});

describe('StudioLayoutsHome full-venue map shortcut', () => {
  it('calls onOpenVenueMap when present and shows the shortcut', () => {
    const onOpenVenueMap = vi.fn();
    render(
      <StudioLayoutsHome
        venues={venues}
        currentVenueId="v1"
        templates={templates}
        layoutCategories={categories}
        canEdit
        onOpenVenue={vi.fn()}
        onSelectTemplate={vi.fn()}
        onOpenVenueMap={onOpenVenueMap}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Design the full-venue map/ }));
    expect(onOpenVenueMap).toHaveBeenCalled();
  });

  it('hides the map shortcut when onOpenVenueMap is undefined', () => {
    render(
      <StudioLayoutsHome
        venues={venues}
        currentVenueId="v1"
        templates={templates}
        layoutCategories={categories}
        canEdit
        onOpenVenue={vi.fn()}
        onSelectTemplate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Design the full-venue map/ })).toBeNull();
  });
});
