import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = {
  user: {
    id: 'platform-user',
    email: 'punistricker@gmail.com',
    name: 'Platform Admin',
    role: 'admin' as const,
  },
  isPlatformAdmin: true,
  hasPlatformSession: true,
  continueAsGuest: vi.fn(),
  registerWithInvite: vi.fn(async () => null),
  organizationSlug: null,
  logout: vi.fn(),
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
    authState.hasPlatformSession = true;
    authState.logout = vi.fn();
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

  it('does not dump a platform support session on #/platform-login into the venue workspace', async () => {
    authState.isPlatformAdmin = false;
    authState.hasPlatformSession = true;
    authState.user = {
      id: 'support-user',
      email: 'support@example.com',
      name: 'Platform Support',
      role: 'admin',
    };
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /platform administrator access required/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByTestId('platform-console')).not.toBeInTheDocument();
    expect(screen.queryByTestId('venue-workspace')).not.toBeInTheDocument();
  });

  it('does not open the console for a platform support session on #/platform-admin', async () => {
    window.location.hash = '#/platform-admin';
    authState.isPlatformAdmin = false;
    authState.hasPlatformSession = true;
    authState.user = {
      id: 'support-user',
      email: 'support@example.com',
      name: 'Platform Support',
      role: 'admin',
    };
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /platform administrator access required/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /return to workspace/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('platform-console')).not.toBeInTheDocument();
    expect(screen.queryByTestId('venue-workspace')).not.toBeInTheDocument();
  });

  it('signs out a denied platform support session instead of returning to the workspace', async () => {
    authState.isPlatformAdmin = false;
    authState.hasPlatformSession = true;
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /sign out/i }));
    expect(authState.logout).toHaveBeenCalledTimes(1);
  });

  it('still opens the venue workspace for a local-mode session on #/platform-login', async () => {
    authState.isPlatformAdmin = false;
    authState.hasPlatformSession = false;
    authState.user = {
      id: 'local-admin',
      email: 'admin@local',
      name: 'Local Admin',
      role: 'admin',
    };
    render(<App />);
    expect(await screen.findByTestId('venue-workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('platform-console')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /platform administrator access required/i })).not.toBeInTheDocument();
  });

  it('keeps Return to workspace for a local-mode session on #/platform-admin', async () => {
    window.location.hash = '#/platform-admin';
    authState.isPlatformAdmin = false;
    authState.hasPlatformSession = false;
    authState.user = {
      id: 'local-admin',
      email: 'admin@local',
      name: 'Local Admin',
      role: 'admin',
    };
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /platform administrator access required/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to workspace/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^sign out$/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('platform-console')).not.toBeInTheDocument();
    expect(screen.queryByTestId('venue-workspace')).not.toBeInTheDocument();
  });
});
