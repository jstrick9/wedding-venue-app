import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PrintView } from './PrintView';
import { setTableSpecs } from '../hooks/useLayoutState';
import { Venue, PlacedTable, PlacedFixture, Guest } from '../types';

describe('PrintView (Print / Export Polish)', () => {
  const sampleVenue: Venue = {
    id: 'v1',
    name: 'Grand Ballroom',
    width: 60,
    height: 40,
    capacity: 150,
    category: 'reception',
    color: '#ffffff',
  };

  const sampleTables: PlacedTable[] = [
    {
      id: 't1',
      type: 'table',
      specId: 'round-60',
      x: 10,
      y: 10,
      rotation: 0,
      label: 'Table 1',
      guests: ['g1'],
      chairCount: 8,
    },
  ];

  const sampleFixtures: PlacedFixture[] = [
    {
      id: 'f1',
      type: 'fixture',
      specId: 'dance-floor',
      x: 20,
      y: 20,
      rotation: 0,
      label: 'Dance Floor',
    },
  ];

  const sampleGuests: Guest[] = [
    {
      id: 'g1',
      name: 'Alice Smith',
      email: 'alice@example.com',
      rsvpStatus: 'confirmed',
      tableId: 't1',
      seatNumber: 1,
      mealChoice: 'vegetarian',
      dietaryRestrictions: 'nut allergy',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    setTableSpecs([
      { id: 'round-60', name: 'Round 60"', shape: 'circle', width: 5, height: 5, capacity: 8, showChairs: true },
    ]);
  });

  it('renders with .spm-print-view root class so print CSS scopes cleanly to floor plan', () => {
    const onClose = vi.fn();
    const { container } = render(
      <PrintView
        venue={sampleVenue}
        tables={sampleTables}
        fixtures={sampleFixtures}
        guests={sampleGuests}
        layoutName="Evening Gala"
        onClose={onClose}
      />,
    );

    const root = container.querySelector('.spm-print-view');
    expect(root).not.toBeNull();
  });

  it('hides top action bar in print mode via no-print and print:hidden classes', () => {
    const { container } = render(
      <PrintView
        venue={sampleVenue}
        tables={sampleTables}
        fixtures={sampleFixtures}
        guests={sampleGuests}
        layoutName="Evening Gala"
        onClose={vi.fn()}
      />,
    );

    const actionBar = container.querySelector('.no-print');
    expect(actionBar).not.toBeNull();
    expect(actionBar?.className).toContain('print:hidden');
  });

  it('calls window.print() when the Print button is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(
      <PrintView
        venue={sampleVenue}
        tables={sampleTables}
        fixtures={sampleFixtures}
        guests={sampleGuests}
        layoutName="Evening Gala"
        onClose={vi.fn()}
      />,
    );

    const printBtn = screen.getByRole('button', { name: /print/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('shows floor plan summary stats including capacity and seated guests', () => {
    render(
      <PrintView
        venue={sampleVenue}
        tables={sampleTables}
        fixtures={sampleFixtures}
        guests={sampleGuests}
        layoutName="Evening Gala"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Grand Ballroom/)).toBeInTheDocument();
    expect(screen.getByText(/Evening Gala/)).toBeInTheDocument();
    expect(screen.getAllByText(/Table 1/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
    expect(screen.getByText(/nut allergy/)).toBeInTheDocument();
  });

  it('computes total capacity from placed tables', () => {
    render(
      <PrintView
        venue={sampleVenue}
        tables={sampleTables}
        fixtures={sampleFixtures}
        guests={sampleGuests}
        layoutName="Evening Gala"
        onClose={vi.fn()}
      />,
    );

    // Table 1 has custom chairCount = 8.
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Total Capacity')).toBeInTheDocument();
  });

  it('shows a warning toast when PNG export is clicked without an SVG ref ready', () => {
    render(
      <PrintView
        venue={sampleVenue}
        tables={sampleTables}
        fixtures={sampleFixtures}
        guests={sampleGuests}
        layoutName="Evening Gala"
        onClose={vi.fn()}
      />,
    );

    const pngBtn = screen.getByRole('button', { name: /png/i });
    fireEvent.click(pngBtn);
    expect(screen.getByRole('button', { name: /png/i })).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <PrintView
        venue={sampleVenue}
        tables={sampleTables}
        fixtures={sampleFixtures}
        guests={sampleGuests}
        layoutName="Evening Gala"
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders print sheet toggles checked by default and shows Linen Color Key & Setup Checklist', () => {
    render(
      <PrintView
        venue={sampleVenue}
        tables={sampleTables}
        fixtures={sampleFixtures}
        guests={sampleGuests}
        layoutName="Evening Gala"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/Dietary & Meal notes/i)).toBeChecked();
    expect(screen.getByLabelText(/Linen color key/i)).toBeChecked();
    expect(screen.getByLabelText(/Room setup checklist/i)).toBeChecked();

    expect(screen.getByRole('heading', { name: /Linen Color Key/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Room Setup Checklist/i })).toBeInTheDocument();
    expect(screen.getByText(/nut allergy/i)).toBeInTheDocument();
  });

  it('toggling checkboxes hides/shows dietary notes, Linen Color Key, and Room Setup Checklist', () => {
    render(
      <PrintView
        venue={sampleVenue}
        tables={sampleTables}
        fixtures={sampleFixtures}
        guests={sampleGuests}
        layoutName="Evening Gala"
        onClose={vi.fn()}
      />,
    );

    const dietaryCheckbox = screen.getByLabelText(/Dietary & Meal notes/i);
    const linenCheckbox = screen.getByLabelText(/Linen color key/i);
    const checklistCheckbox = screen.getByLabelText(/Room setup checklist/i);

    // Uncheck dietary notes
    fireEvent.click(dietaryCheckbox);
    expect(screen.queryByText(/nut allergy/i)).not.toBeInTheDocument();
    // Guest name is still visible
    expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();

    // Uncheck linen key
    fireEvent.click(linenCheckbox);
    expect(screen.queryByRole('heading', { name: /Linen Color Key/i })).not.toBeInTheDocument();

    // Uncheck setup checklist
    fireEvent.click(checklistCheckbox);
    expect(screen.queryByRole('heading', { name: /Room Setup Checklist/i })).not.toBeInTheDocument();

    // Recheck setup checklist
    fireEvent.click(checklistCheckbox);
    expect(screen.getByRole('heading', { name: /Room Setup Checklist/i })).toBeInTheDocument();
  });
});
