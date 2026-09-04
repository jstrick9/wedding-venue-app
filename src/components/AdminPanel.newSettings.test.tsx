import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    getAllUsers: () => [],
    organizationId: 'org-1',
  }),
}));

describe('AdminPanel new System Settings modules (#147)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const dummyProps: any = {
    onClose: vi.fn(),
    currentLayout: {
      tables: [],
      fixtures: [],
      venueId: 'v1',
      category: 'indoor' as const,
    },
    onLoadTemplateForEdit: vi.fn(),
    onOpenVenueMap: vi.fn(),
  };

  it('renders System Status & Quick Diagnostics banner at top of AdminPanel', () => {
    render(<AdminPanel {...dummyProps} />);

    expect(screen.getByText(/healthy/i)).toBeInTheDocument();
    expect(screen.getByText(/workspace data/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /💬\s*templates/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /🛠️\s*checklists/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /🛡️\s*security/i })
    ).toBeInTheDocument();
  });

  it('switches to Communication Templates section when clicked in diagnostic banner', () => {
    render(<AdminPanel {...dummyProps} />);

    const tplBtn = screen.getByRole('button', { name: /💬\s*templates/i });
    fireEvent.click(tplBtn);

    expect(
      screen.getByText(/client communication & quick reply templates/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/✨ layout approved/i)).toBeInTheDocument();
  });

  it('switches to Operations Checklists section when clicked in diagnostic banner', () => {
    render(<AdminPanel {...dummyProps} />);

    const chkBtn = screen.getByRole('button', { name: /🛠️\s*checklists/i });
    fireEvent.click(chkBtn);

    expect(
      screen.getByText(/operations & event-day checklist settings/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/confirm floor plan approval and final guest count/i)
    ).toBeInTheDocument();
  });

  it('switches to Security & Audit section when clicked in diagnostic banner', () => {
    render(<AdminPanel {...dummyProps} />);

    const secBtn = screen.getByRole('button', {
      name: /🛡️\s*security/i,
    });
    fireEvent.click(secBtn);

    expect(
      screen.getByText(/security, audit log & data privacy settings/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/workspace authentication & security rules/i)
    ).toBeInTheDocument();
  });
});
