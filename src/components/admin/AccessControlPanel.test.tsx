import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccessControlPanel } from './AccessControlPanel';
import React from 'react';

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', role: 'admin', name: 'Administrator' },
  }),
}));

describe('AccessControlPanel Portal Access Tab (#146)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all 4 tabs including Couples & Guest Portal Access Rules', () => {
    const onClose = vi.fn();
    render(<AccessControlPanel onClose={onClose} />);

    expect(
      screen.getByRole('button', { name: /couples & guest portal access rules/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^👥\s*roles/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^🔑\s*permissions/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /audit log/i })).toBeInTheDocument();
  });

  it('switches to portal access rules tab and displays policies with toggle switches', () => {
    render(<AccessControlPanel onClose={() => {}} />);

    const portalTab = screen.getByRole('button', {
      name: /couples & guest portal access rules/i,
    });
    fireEvent.click(portalTab);

    expect(
      screen.getByText('Couples: Floor Plan & Seating Layout Design')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Couples: Collaborative Wedding Timeline Editing')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Guests: RSVP & Meal Choice Submission')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Guests: Portal Password Security Authentication')
    ).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(8);

    // Toggle the first rule
    expect(checkboxes[0]).toBeChecked();
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
  });
});
