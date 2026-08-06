import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AdminPanel Tables/Seating tab', () => {
  it('shows separate Table Types and Seating Types sections', async () => {
    const user = userEvent.setup();
    render(
      <AdminPanel
        onClose={() => undefined}
        currentLayout={{ tables: [], fixtures: [], venueId: 'v1', category: 'reception' }}
        onLoadTemplateForEdit={() => undefined}
      />,
    );

    // The merged "Tables, Chairs & Linens" tab opens the Tables/Seating sub-editor by default.
    const seatingTab = screen.getByRole('button', { name: /tables, chairs & linens/i });
    await user.click(seatingTab);

    expect(screen.getAllByText(/table types/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/seating types/i).length).toBeGreaterThan(0);
  });

  it('switches between merged seating sub-editors (Tables → Chairs → Linens)', async () => {
    const user = userEvent.setup();
    render(
      <AdminPanel
        onClose={() => undefined}
        currentLayout={{ tables: [], fixtures: [], venueId: 'v1', category: 'reception' }}
        onLoadTemplateForEdit={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: /tables, chairs & linens/i }));

    // Sub-editor tabs are present (Spacing was moved out to Layout Content).
    const chairsSub = screen.getByRole('button', { name: /💺 Chairs/i });
    const linensSub = screen.getByRole('button', { name: /🎨 Linens/i });
    expect(chairsSub).toBeTruthy();
    expect(linensSub).toBeTruthy();
    // Spacing is no longer a sub-editor of Tables/Chairs/Linens.
    expect(screen.queryByRole('button', { name: /📐 Spacing/i })).toBeNull();

    await user.click(chairsSub);
    // Chairs editor renders its section title.
    expect(screen.getAllByText(/chair types/i).length).toBeGreaterThan(0);

    await user.click(linensSub);
    // Linens editor renders.
    expect(screen.getAllByText(/table linen colors/i).length).toBeGreaterThan(0);
  });

  it('exposes Spacing as its own section under the Layout Content category', async () => {
    const user = userEvent.setup();
    render(
      <AdminPanel
        onClose={() => undefined}
        currentLayout={{ tables: [], fixtures: [], venueId: 'v1', category: 'reception' }}
        onLoadTemplateForEdit={() => undefined}
      />,
    );

    // Open the Layout Content category via the rail.
    const layoutCategory = screen.getByRole('button', { name: /Layout Content/i });
    await user.click(layoutCategory);

    // The pill (with aria-current="page") is the top-level Spacing nav; other
    // "Spacing" buttons live inside the editor content itself.
    const spacingPill = screen.getAllByRole('button', { name: /Spacing/i }).find((b) => b.getAttribute('aria-current') === 'page');
    expect(spacingPill).toBeTruthy();
    await user.click(spacingPill!);
    expect(screen.getAllByText(/spacing & collision settings/i).length).toBeGreaterThan(0);
  });
});