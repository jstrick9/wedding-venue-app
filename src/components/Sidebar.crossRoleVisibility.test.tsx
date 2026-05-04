import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Sidebar } from './Sidebar';
import { setTableSpecs, setFixtureTypes } from '../hooks/useLayoutState';

function renderSidebar(isAdmin: boolean, currentVenueCategory: string) {
  return render(
    <Sidebar
      width={360}
      collapsed={false}
      onWidthChange={() => undefined}
      onCollapsedChange={() => undefined}
      zoom={1}
      onZoomChange={() => undefined}
      showGrid={true}
      onShowGridChange={() => undefined}
      gridSize={5}
      onGridSizeChange={() => undefined}
      onDragStart={() => undefined}
      onDragEnd={() => undefined}
      currentDragItem={null}
      onClearLayout={() => undefined}
      isAdmin={isAdmin}
      onViewImage={() => undefined}
      layoutCategories={[] as any}
      currentVenueCategory={currentVenueCategory}
      venueWidth={60}
      venueHeight={40}
      canvasWidth={100}
      canvasHeight={80}
      onResetView={() => undefined}
      onResetToVenue={() => undefined}
      onResetToCanvas={() => undefined}
      placedTables={[]}
      placedFixtures={[]}
    />,
  );
}

describe('Sidebar cross-role visibility for category-restricted items', () => {
  it('shows only category-matching table and venue fixture to guest/basic users', async () => {
    const user = userEvent.setup();

    setTableSpecs([
      {
        id: 'tbl-rec',
        name: 'Reception Table',
        shape: 'round',
        width: 6,
        height: 6,
        capacity: 10,
        color: '#ffffff',
        venueCategories: ['reception'],
      } as any,
      {
        id: 'tbl-cer',
        name: 'Ceremony Table',
        shape: 'round',
        width: 6,
        height: 6,
        capacity: 10,
        color: '#ffffff',
        venueCategories: ['ceremony'],
      } as any,
    ]);

    setFixtureTypes([
      {
        id: 'fix-rec',
        name: 'Reception Fixture',
        category: 'interior',
        shape: 'rectangle',
        width: 4,
        height: 4,
        color: '#cccccc',
        icon: '🎉',
        visibleToUsers: true,
        venueCategories: ['reception'],
      } as any,
      {
        id: 'fix-hidden',
        name: 'Hidden Fixture',
        category: 'interior',
        shape: 'rectangle',
        width: 4,
        height: 4,
        color: '#cccccc',
        icon: '🚫',
        visibleToUsers: false,
        venueCategories: ['reception'],
      } as any,
    ]);

    renderSidebar(false, 'reception');

    expect(screen.getByText('Reception Table')).toBeInTheDocument();
    expect(screen.queryByText('Ceremony Table')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Venue/i }));
    expect(screen.getByText('Reception Fixture')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Fixture')).not.toBeInTheDocument();
  });

  it('admin sees all category-restricted items regardless of current venue category', async () => {
    const user = userEvent.setup();

    setTableSpecs([
      {
        id: 'tbl-rec',
        name: 'Reception Table',
        shape: 'round',
        width: 6,
        height: 6,
        capacity: 10,
        color: '#ffffff',
        venueCategories: ['reception'],
      } as any,
      {
        id: 'tbl-cer',
        name: 'Ceremony Table',
        shape: 'round',
        width: 6,
        height: 6,
        capacity: 10,
        color: '#ffffff',
        venueCategories: ['ceremony'],
      } as any,
    ]);

    setFixtureTypes([
      {
        id: 'fix-rec',
        name: 'Reception Fixture',
        category: 'interior',
        shape: 'rectangle',
        width: 4,
        height: 4,
        color: '#cccccc',
        icon: '🎉',
        visibleToUsers: true,
        venueCategories: ['reception'],
      } as any,
      {
        id: 'fix-hidden',
        name: 'Hidden Fixture',
        category: 'interior',
        shape: 'rectangle',
        width: 4,
        height: 4,
        color: '#cccccc',
        icon: '🚫',
        visibleToUsers: false,
        venueCategories: ['reception'],
      } as any,
    ]);

    renderSidebar(true, 'reception');

    expect(screen.getByText('Reception Table')).toBeInTheDocument();
    expect(screen.getByText('Ceremony Table')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Venue/i }));
    expect(screen.getByText('Reception Fixture')).toBeInTheDocument();
    expect(screen.getByText('Hidden Fixture')).toBeInTheDocument();
  });
});
