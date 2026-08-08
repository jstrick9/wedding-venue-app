import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoupleTimelineTab } from './CoupleTimelineTab';
import { CoupleEvent } from '../../types';

describe('CoupleTimelineTab (Couples Portal Timeline)', () => {
  const sampleEvent: CoupleEvent = {
    id: 'ev-timeline-1',
    coupleName: 'Alice & Bob',
    inviteToken: 'tok-tl-1',
    status: 'active',
    eventDate: '2026-10-10',
    availableSpaces: ['v1'],
    selectedSpaces: ['v1'],
    layoutStatus: 'none',
    layoutHistory: [],
    collaborators: [],
    addOns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders "Self-Managed / Planner Timeline" banner when Day of Coordination is not booked', () => {
    const onNav = vi.fn();
    render(
      <CoupleTimelineTab
        event={sampleEvent}
        canEdit={true}
        onNavigateToPackage={onNav}
      />,
    );

    expect(screen.getByText(/Self-Managed \/ Planner Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Alice & Bob — Wedding Timeline/i)).toBeInTheDocument();

    const pkgBtn = screen.getByRole('button', { name: /view packages & add-ons/i });
    fireEvent.click(pkgBtn);
    expect(onNav).toHaveBeenCalledTimes(1);
  });

  it('renders "★ Venue Coordinated Event" banner when Day of Coordination is booked', () => {
    const coordinatedEvent: CoupleEvent = {
      ...sampleEvent,
      venueCoordinationBooked: true,
    };

    render(
      <CoupleTimelineTab
        event={coordinatedEvent}
        canEdit={true}
      />,
    );

    expect(screen.getByText(/★ Venue Coordinated Event/i)).toBeInTheDocument();
    expect(screen.queryByText(/Self-Managed \/ Planner Timeline/i)).not.toBeInTheDocument();
  });

  it('allows adding a new timeline day and timeline event', () => {
    render(
      <CoupleTimelineTab
        event={sampleEvent}
        canEdit={true}
      />,
    );

    // Open add day form
    const addDayBtn = screen.getByRole('button', { name: /add day/i });
    fireEvent.click(addDayBtn);

    const labelInput = screen.getByPlaceholderText(/e\.g\. Rehearsal Dinner/i);
    fireEvent.change(labelInput, { target: { value: 'Rehearsal Dinner' } });
    fireEvent.click(screen.getByRole('button', { name: /save day/i }));

    expect(screen.getByText('Rehearsal Dinner')).toBeInTheDocument();

    // Now add a timeline event
    const addEventBtn = screen.getByRole('button', { name: /add timeline event/i });
    fireEvent.click(addEventBtn);

    const titleInput = screen.getByPlaceholderText(/e\.g\. Ceremony Begins/i);
    fireEvent.change(titleInput, { target: { value: 'First Look Photography' } });
    fireEvent.click(screen.getByRole('button', { name: /^add event$/i }));

    expect(screen.getByText('First Look Photography')).toBeInTheDocument();

    // Mark event completed
    const checkbox = screen.getByRole('checkbox', { name: /mark milestone First Look Photography complete/i });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
