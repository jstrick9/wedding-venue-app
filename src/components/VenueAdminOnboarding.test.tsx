import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookupMock = vi.fn();
const authState = {
  user: {
    id: 'platform-1',
    email: 'punistricker@gmail.com',
    name: 'Platform Admin',
    username: 'punistricker@gmail.com',
    role: 'admin',
    password: '',
    isActive: true,
    createdAt: '2026-01-01',
  },
  loginForOrganization: vi.fn(),
  hasPlatformSession: true,
  logout: vi.fn(),
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../services/platform/platformAdminService', () => ({
  lookupVenueAdminInvite: (...args: unknown[]) => lookupMock(...args),
  acceptVenueAdminInvite: vi.fn(),
}));

vi.mock('../services/backend/AuthBackend', () => ({
  signUpVenueAdminWithInvite: vi.fn(),
}));

vi.mock('../services/backend/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock('../services/platform/publicVenueService', () => ({
  getPublicVenueBranding: () => Promise.resolve(null),
}));

import VenueAdminOnboarding from './VenueAdminOnboarding';

describe('VenueAdminOnboarding session isolation', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    sessionStorage.clear();
  });

  it('shows the invited-email setup form even when a platform admin is signed in', async () => {
    lookupMock.mockResolvedValue({
      context: {
        organizationId: 'org-1',
        organizationName: 'Seven Paths Manor',
        organizationSlug: 'seven-paths-manor',
        email: 'stricklandjoshua01@gmail.com',
        role: 'owner',
        expiresAt: '2026-08-31T00:00:00.000Z',
      },
    });

    render(<VenueAdminOnboarding token="va-abc123def4567890" />);

    await waitFor(() => {
      expect(screen.getByLabelText(/invited email address/i)).toHaveValue('stricklandjoshua01@gmail.com');
    });
    expect(screen.getByRole('button', { name: /create venue administrator account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in and claim venue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to platform console/i })).toBeInTheDocument();
    expect(screen.queryByText(/sign out of the platform administrator account/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out and continue as invited admin/i })).not.toBeInTheDocument();
    expect(screen.getByText(/platform administration stays signed in separately/i)).toBeInTheDocument();
  });
});
