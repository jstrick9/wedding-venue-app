import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookupMock = vi.fn();
const brandingMock = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
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
  }),
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
  getPublicVenueBranding: (...args: unknown[]) => brandingMock(...args),
}));

import VenueAdminOnboarding from './VenueAdminOnboarding';

describe('VenueAdminOnboarding venue-only claim', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    brandingMock.mockReset().mockResolvedValue(null);
    sessionStorage.clear();
  });

  it('names the venue, requires a new password, and hides platform / existing-account chrome', async () => {
    lookupMock.mockResolvedValue({
      context: {
        organizationId: 'org-1',
        organizationName: 'Seven Paths Manor',
        organizationSlug: 'seven-paths-manor',
        email: 'venue.owner@example.com',
        role: 'owner',
        expiresAt: '2026-08-31T00:00:00.000Z',
      },
    });

    render(<VenueAdminOnboarding token="va-abc123def4567890" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /claim seven paths manor's venue workspace/i })).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/invited email address/i)).toHaveValue('venue.owner@example.com');
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /password requirements/i })).toHaveTextContent(/at least 8 characters/i);
    expect(screen.getByRole('list', { name: /password requirements/i })).toHaveTextContent(/uppercase letter/i);
    expect(screen.getByRole('list', { name: /password requirements/i })).toHaveTextContent(/lowercase letter/i);
    expect(screen.getByRole('list', { name: /password requirements/i })).toHaveTextContent(/one number/i);
    expect(screen.getByRole('list', { name: /password requirements/i })).toHaveTextContent(/special character/i);
    expect(screen.getByRole('button', { name: /show new password/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show confirmed password/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim venue workspace/i })).toBeDisabled();
    expect(screen.getByText(/existing events, layouts, guests, and team work stay with seven paths manor/i)).toBeInTheDocument();
    expect(screen.queryByText(/venue setup uses the invited email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/platform administration stays signed in separately/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/already created this venue account/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in and claim venue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /return to platform console/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /return to platform login/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/sign out of the platform administrator account/i)).not.toBeInTheDocument();
  });

  it('shows the claim form even if venue branding never returns', async () => {
    lookupMock.mockResolvedValue({
      context: {
        organizationId: 'org-1',
        organizationName: 'Seven Paths Manor',
        organizationSlug: 'seven-paths-manor',
        email: 'venue.owner@example.com',
        role: 'owner',
        expiresAt: '2026-08-31T00:00:00.000Z',
      },
    });
    brandingMock.mockImplementation(() => new Promise(() => {}));

    render(<VenueAdminOnboarding token="va-abc123def4567890" />);

    expect(await screen.findByRole('button', { name: /claim venue workspace/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/invited email address/i)).toHaveValue('venue.owner@example.com');
    expect(screen.queryByText(/checking invitation/i)).not.toBeInTheDocument();
  });
});
