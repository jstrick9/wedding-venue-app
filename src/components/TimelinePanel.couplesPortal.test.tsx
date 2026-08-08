import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { TimelinePanel } from './TimelinePanel';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { CoupleEvent } from '../types';
import { getCoupleEvents } from '../services/couples/coupleService';

describe('TimelinePanel (Venue Portal <-> Couples Portal Integration)', () => {
  const sampleCouple: CoupleEvent = {
    id: 'ev-tl-int-1',
    coupleName: 'Smith & Jones',
    inviteToken: 'tok-tl-int-1',
    status: 'active',
    eventDate: '2026-09-19',
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

  it('displays "★ Day of Coordination Booked" banner and enables full timeline editing when couple booked coordination', () => {
    const coordinatedCouple: CoupleEvent = {
      ...sampleCouple,
      venueCoordinationBooked: true,
    };
    localStorage.setItem(STORAGE_KEYS.COUPLE_EVENTS, JSON.stringify([coordinatedCouple]));

    render(<TimelinePanel onClose={() => undefined} />);

    // Select the couple event in the dropdown
    const select = screen.getByLabelText(/couple event/i);
    fireEvent.change(select, { target: { value: 'ev-tl-int-1' } });

    expect(screen.getByText(/★ Venue Coordination Service Booked/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /➕ Add Day/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Add Event/i })).toBeInTheDocument();

    // Add an event
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Event/i }));
    const titleInput = screen.getByPlaceholderText(/e\.g\., Hair & Makeup/i);
    fireEvent.change(titleInput, { target: { value: 'Ceremony Processional' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add Event$/i }));

    expect(screen.getByText('Ceremony Processional')).toBeInTheDocument();
  });

  it('displays "Day of Coordination Not Booked" banner in read-only preview mode when coordination is not booked', () => {
    localStorage.setItem(STORAGE_KEYS.COUPLE_EVENTS, JSON.stringify([sampleCouple]));

    render(<TimelinePanel onClose={() => undefined} />);

    const select = screen.getByLabelText(/couple event/i);
    fireEvent.change(select, { target: { value: 'ev-tl-int-1' } });

    expect(screen.getByText(/Day of Coordination Not Booked — Smith & Jones/i)).toBeInTheDocument();
    expect(screen.getByText(/read-only preview/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /➕ Add Day/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Add Event/i })).not.toBeInTheDocument();
  });

  it('allows venue admin to click "Add Day of Coordination ($1,000)" to add service and unlock collaborative editing', () => {
    localStorage.setItem(STORAGE_KEYS.COUPLE_EVENTS, JSON.stringify([sampleCouple]));

    render(<TimelinePanel onClose={() => undefined} />);

    const select = screen.getByLabelText(/couple event/i);
    fireEvent.change(select, { target: { value: 'ev-tl-int-1' } });

    const addServiceBtn = screen.getByRole('button', { name: /add day of coordination/i });
    fireEvent.click(addServiceBtn);

    expect(screen.getByRole('heading', { name: /add day of coordination service\?/i })).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /add coordination & unlock/i });
    fireEvent.click(confirmBtn);

    // Verify couple event is updated in storage
    const stored = getCoupleEvents();
    expect(stored[0].venueCoordinationBooked).toBe(true);

    // Verify banner switches to coordinated mode
    expect(screen.getByText(/★ Venue Coordination Service Booked/i)).toBeInTheDocument();
  });
});
