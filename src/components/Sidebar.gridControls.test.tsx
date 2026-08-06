import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';

function renderSidebar(overrides: Record<string, unknown> = {}) {
  return render(
    <Sidebar
      width={280}
      collapsed={false}
      onWidthChange={() => undefined}
      onCollapsedChange={() => undefined}
      zoom={1}
      onZoomChange={() => undefined}
      showGrid={false}
      onShowGridChange={() => undefined}
      gridSize={5}
      onGridSizeChange={() => undefined}
      onDragStart={() => undefined}
      onDragEnd={() => undefined}
      currentDragItem={null}
      onClearLayout={() => undefined}
      isAdmin={true}
      currentUser={{ id: 'u1', role: 'admin', name: 'Admin', isActive: true } as any}
      onViewImage={() => undefined}
      layoutCategories={[] as any}
      currentVenueCategory="reception"
      venueWidth={60}
      venueHeight={40}
      canvasWidth={100}
      canvasHeight={80}
      onResetView={() => undefined}
      onResetToVenue={() => undefined}
      onResetToCanvas={() => undefined}
      placedTables={[]}
      placedFixtures={[]}
      {...(overrides as any)}
    />,
  );
}

describe('Sidebar grid & snap controls', () => {
  it('renders grid/snap controls and reflects the showGrid state', () => {
    renderSidebar({ showGrid: true, snapToGrid: true, gridSize: 10, gridContrast: 0.7 });
    // Grid & Snap now lives in the Settings section.
    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    const showGridCheckbox = screen.getByLabelText('Show grid') as HTMLInputElement;
    const snapCheckbox = screen.getByLabelText('Snap to grid') as HTMLInputElement;
    expect(showGridCheckbox.checked).toBe(true);
    expect(snapCheckbox.checked).toBe(true);
    expect(screen.getByDisplayValue('10 ft')).toBeTruthy();
  });

  it('calls onShowGridChange when the toggle is flipped', () => {
    const onShowGridChange = vi.fn();
    renderSidebar({ onShowGridChange, showGrid: false });
    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    fireEvent.click(screen.getByLabelText('Show grid'));
    expect(onShowGridChange).toHaveBeenCalledWith(true);
  });

  it('calls onSnapToGridChange and onGridSizeChange on interaction', () => {
    const onSnapToGridChange = vi.fn();
    const onGridSizeChange = vi.fn();
    renderSidebar({ onSnapToGridChange, onGridSizeChange });
    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    fireEvent.click(screen.getByLabelText('Snap to grid'));
    expect(onSnapToGridChange).toHaveBeenCalledWith(true);
    fireEvent.change(screen.getByDisplayValue('5 ft'), { target: { value: '10' } });
    expect(onGridSizeChange).toHaveBeenCalledWith(10);
  });
});
