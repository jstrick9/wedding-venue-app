import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { SeatingAndLinensManagement } from './admin/SeatingAndLinensManagement';
import { StructuresManagement } from './admin/StructuresManagement';
import { VenueCalendar } from './VenueCalendar';
import { TimelinePanel } from './TimelinePanel';
import { Button, Badge } from './ui';
import { setConfig, getConfig } from '../config';
import { defaultVenues } from '../data/venueData';

describe('Universal Branding Completeness — Calendar, Studio Subsections, Timeline & UI Primitives', () => {
  beforeEach(() => {
    localStorage.clear();
    setConfig({
      ...getConfig(),
      primaryColor: '#1E3A8A', // custom deep navy blue
      primaryDark: '#172A67',
      primaryLight: '#3B5998',
      accentColor: '#F59E0B',
    });
  });

  it('applies custom brand color to UI Button and Badge primitives (e.g. Upcoming Events actions)', () => {
    const { container } = render(
      <div>
        <Button tone="primary" data-testid="primary-btn">Schedule Upcoming Event</Button>
        <Badge tone="primary" data-testid="primary-badge">Upcoming</Badge>
      </div>
    );

    const btn = screen.getByTestId('primary-btn');
    expect(btn.className).toContain('btn-primary');
    expect(btn.style.backgroundColor).toBe('rgb(30, 58, 138)'); // #1E3A8A

    const badge = screen.getByTestId('primary-badge');
    expect(badge.style.color).toBe('rgb(30, 58, 138)');
  });

  it('applies custom brand color to design studio subsection buttons (Tables/Seating, Chairs, Linens)', () => {
    const dummyProps: any = {
      config: getConfig(),
      tables: [],
      setTables: () => {},
      tableTypes: [],
      setTableTypes: () => {},
      tableSpecs: [],
      setTableSpecs: () => {},
      chairs: [],
      setChairs: () => {},
      chairTypes: [],
      setChairTypes: () => {},
      chairSpecs: [],
      setChairSpecs: () => {},
      linenColors: [],
      setLinenColors: () => {},
      expandedLinens: new Set(),
      setExpandedLinens: () => {},
      expandAllLinens: () => {},
      collapseAllLinens: () => {},
      expandedTables: new Set(),
      setExpandedTables: () => {},
      expandAllTables: () => {},
      collapseAllTables: () => {},
      expandedChairs: new Set(),
      setExpandedChairs: () => {},
      expandAllChairs: () => {},
      collapseAllChairs: () => {},
      user: { role: 'admin' },
      isAdmin: true,
      venues: [],
      setVenues: () => {},
    };

    render(<SeatingAndLinensManagement {...dummyProps} />);

    // Active default tab is "Tables/Seating"
    const tablesBtn = screen.getByRole('button', { name: /Tables\/Seating/i });
    expect(tablesBtn.className).toContain('btn-primary');
    expect(tablesBtn.style.backgroundColor).toBe('rgb(30, 58, 138)');

    // Click Chairs tab
    const chairsBtn = screen.getByRole('button', { name: /Chairs/i });
    fireEvent.click(chairsBtn);
    expect(chairsBtn.className).toContain('btn-primary');
    expect(chairsBtn.style.backgroundColor).toBe('rgb(30, 58, 138)');
  });

  it('applies custom brand color to structural subsection buttons (Fixtures, Walls)', () => {
    const dummyProps: any = {
      config: getConfig(),
      fixtures: [],
      setFixtures: () => {},
      fixtureTypes: [],
      setFixtureTypes: () => {},
      wallStyles: [],
      setWallStyles: () => {},
      expandedFixtures: new Set(),
      setExpandedFixtures: () => {},
      expandAllFixtures: () => {},
      collapseAllFixtures: () => {},
      expandedWalls: new Set(),
      setExpandedWalls: () => {},
      expandAllWalls: () => {},
      collapseAllWalls: () => {},
      user: { role: 'admin' },
      isAdmin: true,
      venues: [],
      setVenues: () => {},
    };

    render(<StructuresManagement {...dummyProps} />);

    const fixturesBtn = screen.getByRole('button', { name: /Fixtures/i });
    expect(fixturesBtn.className).toContain('btn-primary');
    expect(fixturesBtn.style.backgroundColor).toBe('rgb(30, 58, 138)');

    const wallsBtn = screen.getByRole('button', { name: /Walls/i });
    fireEvent.click(wallsBtn);
    expect(wallsBtn.className).toContain('btn-primary');
    expect(wallsBtn.style.backgroundColor).toBe('rgb(30, 58, 138)');
  });

  it('applies custom brand color to VenueCalendar buttons and legend items', () => {
    render(
      <VenueCalendar
        venues={defaultVenues}
      />
    );

    // Month view button is active by default
    const monthBtn = screen.getByRole('button', { name: /^month$/i });
    expect(monthBtn.className).toContain('btn-primary');
    expect(monthBtn.style.backgroundColor).toBe('rgb(30, 58, 138)');
  });

  it('applies custom brand color to Wedding Timeline buttons and progress bars', () => {
    render(<TimelinePanel onClose={() => {}} inline={false} />);

    // "Create New Timeline" button in empty state uses custom primary color
    const createBtn = screen.getByRole('button', { name: /Create New Timeline/i });
    expect(createBtn.className).toContain('btn-primary');
    expect(createBtn.style.backgroundColor).toBe('rgb(30, 58, 138)');
  });
});
