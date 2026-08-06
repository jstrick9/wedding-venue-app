import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../hooks/useLayoutState', () => ({
  getTableSpecs: () => [
    { id: 's1', name: 'Round Table', shape: 'circle', width: 6, height: 6, capacity: 8, showChairs: true },
  ],
  getFixtureTypes: () => [
    { id: 'f1', name: 'Dance Floor', shape: 'rect', width: 18, height: 18, visibleToUsers: true, isSelectable: true },
  ],
  getDecorItems: () => [{ id: 'd1', name: 'Centerpiece', width: 1, height: 1 }],
  getLinenColors: () => [],
  getDecorArrangements: () => [],
}));

import { CoupleLayoutEditor } from './CoupleLayoutEditor';

const venue = {
  id: 'reception',
  name: 'Reception Hall',
  width: 80,
  height: 60,
  canvasWidth: 80,
  canvasHeight: 60,
  capacity: 200,
  category: 'reception',
} as any;

describe('CoupleLayoutEditor', () => {
  it('renders the space name and palette items', () => {
    render(<CoupleLayoutEditor venue={venue} initial={null} onSave={() => {}} onClose={() => {}} />);
    expect(screen.getAllByText(/Reception Hall/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Round Table/i)).toBeTruthy();
    expect(screen.getByText(/Dance Floor/i)).toBeTruthy();
  });

  it('shows saved item counts in the toolbar', () => {
    render(
      <CoupleLayoutEditor
        venue={venue}
        initial={{
          tables: [{ id: 't1', type: 'table', specId: 's1', x: 10, y: 10, rotation: 0, label: 'Round Table', guests: [] }],
          fixtures: [],
          decor: [],
          updatedAt: new Date().toISOString(),
        }}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/1 item\(s\)/i)).toBeTruthy();
  });

  it('warns when placed seating capacity is below the expected guest count', () => {
    render(
      <CoupleLayoutEditor
        venue={venue}
        guestCount={10}
        initial={{
          tables: [{ id: 't1', type: 'table', specId: 's1', x: 10, y: 10, rotation: 0, label: 'Round Table', guests: [] }], // capacity 8
          fixtures: [],
          decor: [],
          updatedAt: new Date().toISOString(),
        }}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Seats 8 \/ 10 guests/i)).toBeTruthy();
  });

  it('does not warn when seating capacity meets the expected guest count', () => {
    render(
      <CoupleLayoutEditor
        venue={venue}
        guestCount={8}
        initial={{
          tables: [{ id: 't1', type: 'table', specId: 's1', x: 10, y: 10, rotation: 0, label: 'Round Table', guests: [] }], // capacity 8
          fixtures: [],
          decor: [],
          updatedAt: new Date().toISOString(),
        }}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Seats 8 \/ 8 guests/i)).toBeTruthy();
    expect(screen.queryByText(/⚠️/i)).toBeNull();
  });
});
