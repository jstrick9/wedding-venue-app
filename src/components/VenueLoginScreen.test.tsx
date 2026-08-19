import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NEUTRAL_LOGIN_CONFIG } from '../utils/loginBranding';

const getPublicVenueBrandingMock = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    organizationId: null,
    loginForOrganization: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../services/platform/publicVenueService', () => ({
  getPublicVenueBranding: (...args: unknown[]) => getPublicVenueBrandingMock(...args),
}));

vi.mock('./LoginScreen', () => ({
  LoginScreen: ({ brandingOverride }: { brandingOverride?: { venueName?: string; primaryColor?: string } }) => (
    <div>Venue login for {brandingOverride?.venueName} {brandingOverride?.primaryColor}</div>
  ),
}));

import VenueLoginScreen from './VenueLoginScreen';

describe('VenueLoginScreen branding', () => {
  beforeEach(() => {
    getPublicVenueBrandingMock.mockReset();
  });

  it('uses the neutral login palette while loading and when a venue is missing', async () => {
    getPublicVenueBrandingMock.mockResolvedValue(null);
    render(<VenueLoginScreen slug="unknown-venue" />);

    expect(screen.getByText(/loading venue sign-in/i)).toBeInTheDocument();
    expect(await screen.findByText(/venue login not found/i)).toBeInTheDocument();
    const heading = screen.getByRole('heading', { name: /venue login not found/i });
    expect(heading).toHaveStyle({ color: NEUTRAL_LOGIN_CONFIG.primaryColor });
  });

  it('renders the shared login with the venue branding when the tenant exists', async () => {
    getPublicVenueBrandingMock.mockResolvedValue({
      organizationId: 'org-2',
      slug: 'hilltop-barn',
      status: 'active',
      config: { ...NEUTRAL_LOGIN_CONFIG, venueName: 'Hilltop Barn', primaryColor: '#111827' },
    });

    render(<VenueLoginScreen slug="hilltop-barn" />);

    await waitFor(() => {
      expect(screen.getByText(/venue login for hilltop barn/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/#111827/i)).toBeInTheDocument();
  });
});
