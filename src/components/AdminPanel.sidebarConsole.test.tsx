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

describe('AdminPanel sidebar console', () => {
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

  it('keeps the five sections collapsed until clicked and shows a hover description', () => {
    render(<AdminPanel onClose={() => undefined} inline />);

    expect(screen.queryByRole('button', { name: 'Venues' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Spacing' })).not.toBeInTheDocument();

    const inventory = screen.getByRole('button', { name: /Venues & Inventory/i });
    expect(inventory).toHaveAttribute('title', 'Spaces, tables, chairs, linens, fixtures, walls, and decor.');
    expect(inventory).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(inventory);
    expect(inventory).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Venues' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Spacing' })).not.toBeInTheDocument();
  });

  it('writes #/admin/venues when the Venues sidebar item is opened', () => {
    render(<AdminPanel onClose={() => undefined} inline />);
    fireEvent.click(screen.getByRole('button', { name: /Venues & Inventory/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Venues' }));
    expect(window.location.hash).toBe('#/admin/venues');
  });

  it('expands Layout Content without navigating, then Spacing sets aria-current', () => {
    render(<AdminPanel onClose={() => undefined} inline />);
    fireEvent.click(screen.getByRole('button', { name: /Layout Content/i }));
    expect(window.location.hash === '' || window.location.hash === '#/admin').toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Spacing' }));
    expect(screen.getByRole('button', { name: 'Spacing' }).getAttribute('aria-current')).toBe('page');
    expect(window.location.hash).toBe('#/admin/spacing');
  });

  it('opens from a deep hash without showing Overview KPIs', () => {
    window.location.hash = '#/admin/branding';
    render(<AdminPanel onClose={() => undefined} inline />);
    expect(screen.queryByRole('button', { name: /Venues:/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Branding' }).getAttribute('aria-current')).toBe('page');
  });

  it('collapses the sidebar to an icon rail', () => {
    render(<AdminPanel onClose={() => undefined} inline />);
    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(screen.queryByText('Seven Paths Manor')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
  });

  it('uses Home branding chrome, mouse-hold resize, and ← Home close', () => {
    render(<AdminPanel onClose={() => undefined} inline />);
    expect(screen.getByText('Seven Paths Manor')).toBeInTheDocument();
    expect(screen.getByTitle('Email: weddings@sevenpathsmanor.com')).toBeInTheDocument();
    expect(screen.getByTitle('Website: https://www.sevenpathsmanor.com')).toBeInTheDocument();
    expect(screen.getByTitle('Hold mouse button and drag to resize sidebar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to Home/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /return to Dashboard/i })).not.toBeInTheDocument();
  });
});
