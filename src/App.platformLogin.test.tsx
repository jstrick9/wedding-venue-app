import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = {
  user: {
    id: 'platform-user',
    email: 'punistricker@gmail.com',
    name: 'Platform Admin',
    role: 'admin' as const,
  },
  isPlatformAdmin: true,
  continueAsGuest: vi.fn(),
  registerWithInvite: vi.fn(async () => null),
  organizationSlug: null,
};

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => authState,
}));

vi.mock('./components/PlatformAdminPortal', () => ({
  default: () => <div data-testid="platform-console">Platform console</div>,
}));

vi.mock('./components/AuthenticatedApp', () => ({
  default: () => <div data-testid="venue-workspace">Venue workspace</div>,
}));

import App from './App';

describe('App platform login after sign-in', () => {
  beforeEach(() => {
    authState.isPlatformAdmin = true;
    authState.user = {
      id: 'platform-user',
      email: 'punistricker@gmail.com',
      name: 'Platform Admin',
      role: 'admin',
    };
    window.location.hash = '#/platform-login';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('opens the platform console after signing in from #/platform-login', async () => {
    render(<App />);
    expect(await screen.findByTestId('platform-console')).toBeInTheDocument();
    expect(screen.queryByTestId('venue-workspace')).not.toBeInTheDocument();
  });

  it('does not dump a signed-in platform administrator into the venue workspace', async () => {
    window.location.hash = '#/platform-admin/venues';
    render(<App />);
    expect(await screen.findByTestId('platform-console')).toBeInTheDocument();
    expect(screen.queryByTestId('venue-workspace')).not.toBeInTheDocument();
  });
});
