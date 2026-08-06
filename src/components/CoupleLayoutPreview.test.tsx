import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../hooks/useLayoutState', () => ({
  getTableSpecs: () => [
    { id: 's1', name: 'Round Table', shape: 'circle', width: 6, height: 6, capacity: 8 },
  ],
  getFixtureTypes: () => [],
  getDecorItems: () => [],
  getDecorArrangements: () => [],
  getLinenColors: () => [],
}));

import { CoupleLayoutPreview } from './CoupleLayoutPreview';

const venue = { id: 'v1', name: 'Reception Hall', width: 80, height: 60, canvasWidth: 80, canvasHeight: 60, capacity: 200, category: 'reception' } as any;

const baseLayout = {
  tables: [{ id: 't1', type: 'table', specId: 's1', x: 10, y: 10, rotation: 0, label: 'Round Table', guests: [] }],
  fixtures: [],
  decor: [],
  updatedAt: new Date().toISOString(),
};

describe('CoupleLayoutPreview', () => {
  it('renders the drawn layout header', () => {
    render(<CoupleLayoutPreview venue={venue} layout={baseLayout as any} />);
    expect(screen.getByText(/Drawn layout — Reception Hall/i)).toBeTruthy();
  });

  it('shows a seating shortfall when capacity is below guest count', () => {
    render(<CoupleLayoutPreview venue={venue} layout={baseLayout as any} guestCount={10} />);
    expect(screen.getByText(/Seats 8 \/ 10 guests/i)).toBeTruthy();
  });

  it('does not show a shortfall when capacity meets guest count', () => {
    render(<CoupleLayoutPreview venue={venue} layout={baseLayout as any} guestCount={8} />);
    expect(screen.getByText(/Seats 8 \/ 8 guests/i)).toBeTruthy();
    expect(screen.queryByText(/⚠️/i)).toBeNull();
  });
});
