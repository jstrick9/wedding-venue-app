import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminPanel } from './AdminPanel';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      username: 'admin',
      role: 'admin',
      name: 'Admin User',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    isAdmin: true,
    isBasicUser: false,
    isGuest: false,
    login: vi.fn(),
    logout: vi.fn(),
    continueAsGuest: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    getAllUsers: vi.fn(() => []),
  }),
}));

describe('AdminPanel sidebar console (#196)', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('lands on Overview with grouped sidebar categories and KPI shortcuts', () => {
    render(<AdminPanel onClose={() => undefined} inline />);

    expect(screen.getByRole('navigation', { name: /admin categories/i })).toBeInTheDocument();
    expect(screen.getByText('Venues & Inventory')).toBeInTheDocument();
    expect(screen.getByText('Layout Content')).toBeInTheDocument();
    expect(screen.getByText('Couples Portal')).toBeInTheDocument();
    expect(screen.getByText('Branding, Access, & Configuration')).toBeInTheDocument();
    expect(screen.getByText('System & Backup')).toBeInTheDocument();
    expect(screen.getByText(/Admin overview/i)).toBeInTheDocument();

    const venuesBtn = screen.getByRole('button', { name: /Venues:/i });
    expect(venuesBtn).toHaveAttribute('title', 'Switch to Venues');
    const seatingBtn = screen.getByRole('button', { name: /Seating:/i });
    expect(seatingBtn).toHaveAttribute('title', 'Switch to Tables & Seating');
  });

  it('writes #/admin/venues when the Venues sidebar item is opened', () => {
    render(<AdminPanel onClose={() => undefined} inline />);
    fireEvent.click(screen.getByRole('button', { name: 'Venues' }));
    expect(window.location.hash).toBe('#/admin/venues');
  });

  it('opens Spacing with aria-current when Layout Content is clicked', () => {
    render(<AdminPanel onClose={() => undefined} inline />);
    fireEvent.click(screen.getByRole('button', { name: /Layout Content/i }));
    const spacing = screen
      .getAllByRole('button', { name: /Spacing/i })
      .find((button) => button.getAttribute('aria-current') === 'page');
    expect(spacing).toBeTruthy();
    expect(window.location.hash).toBe('#/admin/spacing');
  });

  it('opens from a deep hash without showing Overview KPIs', () => {
    window.location.hash = '#/admin/branding';
    render(<AdminPanel onClose={() => undefined} inline />);
    expect(screen.queryByRole('button', { name: /Venues:/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Branding' }).getAttribute('aria-current')).toBe('page');
  });
});
