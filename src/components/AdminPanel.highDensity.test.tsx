import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminPanel } from './AdminPanel';
import { BrandedSectionHeader, BrandedStatCard } from './admin/shared/AdminSharedComponents';
import { setConfig, getConfig } from '../config';

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

describe('Admin & System Settings High-Density Executive UX (#155)', () => {
  beforeEach(() => {
    localStorage.clear();
    setConfig({
      ...getConfig(),
      primaryColor: '#4A1942',
      primaryDark: '#3d1a45',
      primaryLight: '#6b2c5c',
    });
  });

  it('renders AdminPanel with the compact 2-row executive toolbar and interactive KPI jump buttons', () => {
    render(
      <AdminPanel
        onClose={() => {}}
        inline={true}
      />
    );

    // Verify main header title and status badges
    expect(screen.getByText(/Admin & System Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Healthy/i)).toBeInTheDocument();
    expect(screen.getByText(/LocalStorage/i)).toBeInTheDocument();

    // Verify interactive Quick-Jump KPI pills
    const venuesBtn = screen.getByRole('button', { name: /Venues:/i });
    expect(venuesBtn).toHaveAttribute('title', 'Switch to Venues');

    const seatingBtn = screen.getByRole('button', { name: /Seating:/i });
    expect(seatingBtn).toHaveAttribute('title', 'Switch to Tables & Seating');

    // Click Seating quick-jump button -> switches active tab to seating
    fireEvent.click(seatingBtn);
    expect(screen.getByRole('button', { name: /\+ ⭕ Rounds/i })).toBeInTheDocument();
  });

  it('renders BrandedSectionHeader as a compact inline header bar with left accent border', () => {
    const { container } = render(
      <BrandedSectionHeader
        icon="🏛️"
        title="Test Venues"
        description="Compact inline header"
        config={getConfig()}
        variant="primary"
      />
    );

    expect(screen.getByText('Test Venues')).toBeInTheDocument();
    expect(screen.getByText('Compact inline header')).toBeInTheDocument();

    // Verify left border style
    const card = container.firstChild as HTMLElement;
    expect(card.style.borderLeft).toContain('4px solid');
  });

  it('renders BrandedStatCard as a horizontal KPI badge and interactive button when onClick is provided', () => {
    const onClick = vi.fn();
    render(
      <BrandedStatCard
        icon="🏛️"
        label="Total Venues"
        value={12}
        config={getConfig()}
        variant="primary"
        onClick={onClick}
      />
    );

    const btn = screen.getByRole('button', { name: /Total Venues/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders 1-row Presets and Integrated Toolbars across TableManagement and LinenManagement', () => {
    render(
      <AdminPanel
        onClose={() => {}}
        inline={true}
      />
    );

    // Switch to Seating tab
    fireEvent.click(screen.getByRole('button', { name: /Seating:/i }));

    // Verify 1-row table presets
    expect(screen.getByRole('button', { name: /\+ ⭕ Rounds/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ ▬ Banquets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ 🍸 Cocktails/i })).toBeInTheDocument();

    // Switch to Linens sub-tab
    fireEvent.click(screen.getByRole('button', { name: /🎨\s*Linens/i }));

    // Verify 1-row linen presets
    expect(screen.getByRole('button', { name: /\+ 👑 Classics/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ 💕 Romantic Blush/i })).toBeInTheDocument();
  });
});
