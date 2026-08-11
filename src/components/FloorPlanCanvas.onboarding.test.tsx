import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FloorPlanCanvas } from './FloorPlanCanvas';

const mockVenue: any = {
  id: 'v1',
  name: 'Main Hall',
  category: 'reception',
  width: 50,
  height: 40,
  capacity: 150,
};

describe('FloorPlanCanvas Onboarding Notification (#171)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows onboarding hint on first visit, hides after 2.5s, and never shows again', () => {
    // 1. First visit (localStorage empty)
    const { unmount } = render(
      <FloorPlanCanvas
        venue={mockVenue}
        tables={[]}
        fixtures={[]}
        decor={[]}
        guests={[]}
        selectedId={null}
        zoom={1}
        showGrid={false}
        gridSize={4}
        onSelect={vi.fn()}
        onDoubleClick={vi.fn()}
        onMove={vi.fn()}
        onDrop={vi.fn()}
        onClickToPlace={vi.fn()}
        isDragging={false}
        isAdmin={true}
        onViewImage={vi.fn()}
        panOffset={{ x: 0, y: 0 }}
        onPanChange={vi.fn()}
        onZoomChange={vi.fn()}
      />
    );

    expect(screen.getByText("Let's build your layout")).toBeInTheDocument();

    // Advance timer by 2.5 seconds (2500ms)
    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(screen.queryByText("Let's build your layout")).not.toBeInTheDocument();
    expect(localStorage.getItem('spm_studio_onboarding_seen')).toBe('true');

    unmount();

    // 2. Subsequent visit (localStorage already has 'spm_studio_onboarding_seen' = 'true')
    render(
      <FloorPlanCanvas
        venue={mockVenue}
        tables={[]}
        fixtures={[]}
        decor={[]}
        guests={[]}
        selectedId={null}
        zoom={1}
        showGrid={false}
        gridSize={4}
        onSelect={vi.fn()}
        onDoubleClick={vi.fn()}
        onMove={vi.fn()}
        onDrop={vi.fn()}
        onClickToPlace={vi.fn()}
        isDragging={false}
        isAdmin={true}
        onViewImage={vi.fn()}
        panOffset={{ x: 0, y: 0 }}
        onPanChange={vi.fn()}
        onZoomChange={vi.fn()}
      />
    );

    expect(screen.queryByText("Let's build your layout")).not.toBeInTheDocument();
  });
});
