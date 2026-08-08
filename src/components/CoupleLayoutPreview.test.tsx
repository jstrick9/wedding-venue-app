import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

  it('renders existing layout review pins in the preview and list', () => {
    const pins = [
      {
        id: 'pin-1',
        x: 20,
        y: 30,
        comment: 'Move sweetheart table 5ft left',
        createdAt: '2026-08-08T12:00:00Z',
        authorName: 'Jane Admin',
      },
    ];

    render(
      <CoupleLayoutPreview
        venue={venue}
        layout={baseLayout as any}
        reviewPins={pins}
      />,
    );

    expect(screen.getByText(/Layout Review Pins \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Move sweetheart table 5ft left/i)).toBeInTheDocument();
    expect(screen.getByText(/Jane Admin/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review Pin 1: Move sweetheart table 5ft left/i })).toBeInTheDocument();
  });

  it('allows adding a review pin when onAddReviewPin is provided', () => {
    const onAddReviewPin = vi.fn();
    const { container } = render(
      <CoupleLayoutPreview
        venue={venue}
        layout={baseLayout as any}
        onAddReviewPin={onAddReviewPin}
      />,
    );

    const addPinBtn = screen.getByRole('button', { name: /📍 Add review pin/i });
    fireEvent.click(addPinBtn);

    expect(screen.getByRole('button', { name: /✕ Cancel pin mode/i })).toBeInTheDocument();

    // Click on the SVG canvas to trigger onClickToPlace
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    if (svg) {
      fireEvent.click(svg, { clientX: 100, clientY: 100 });
    }

    const commentInput = screen.getByPlaceholderText(/Enter review note/i);
    expect(commentInput).toBeInTheDocument();

    fireEvent.change(commentInput, { target: { value: 'Need 5ft clearance near exit' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Pin/i }));

    expect(onAddReviewPin).toHaveBeenCalledTimes(1);
    expect(onAddReviewPin.mock.calls[0][1]).toBe('Need 5ft clearance near exit');
  });

  it('calls onRemoveReviewPin when deleting a pin from the list', () => {
    const onRemoveReviewPin = vi.fn();
    const pins = [
      {
        id: 'pin-1',
        x: 20,
        y: 30,
        comment: 'Move sweetheart table 5ft left',
        createdAt: '2026-08-08T12:00:00Z',
        authorName: 'Jane Admin',
      },
    ];

    render(
      <CoupleLayoutPreview
        venue={venue}
        layout={baseLayout as any}
        reviewPins={pins}
        onRemoveReviewPin={onRemoveReviewPin}
      />,
    );

    const deleteBtn = screen.getByRole('button', { name: /Delete review pin 1/i });
    fireEvent.click(deleteBtn);

    expect(onRemoveReviewPin).toHaveBeenCalledWith('pin-1');
  });
});
