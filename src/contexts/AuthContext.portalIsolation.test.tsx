import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  restoreSupabaseSession: vi.fn(),
  setAuthSurface: vi.fn(),
}));

vi.mock('../services/backend/AuthBackend', () => ({
  shouldUseSupabaseAuth: () => true,
  restoreSupabaseSession: (...args: unknown[]) => mocks.restoreSupabaseSession(...args),
  signInWithSupabase: vi.fn(),
  signOutSupabase: vi.fn(),
  signUpOrganizationInvite: vi.fn(),
  signUpWithSupabase: vi.fn(),
}));

vi.mock('../services/backend/supabaseClient', () => ({
  migrateLegacyAuthSessions: () => Promise.resolve(),
  setAuthSurface: (...args: unknown[]) => mocks.setAuthSurface(...args),
}));

vi.mock('../hooks/useLayoutState', () => ({
  getUsers: () => [],
  setUsers: vi.fn(),
}));

import { AuthProvider, useAuth } from './AuthContext';

function ContextProbe() {
  const context = useAuth();
  return (
    <dl>
      <dt>User</dt><dd data-testid="user">{context.user?.name || 'none'}</dd>
      <dt>Organization</dt><dd data-testid="organization">{context.organizationId || 'none'}</dd>
      <dt>Platform role</dt><dd data-testid="platform-role">{context.platformRole || 'none'}</dd>
      <dt>Sessions</dt><dd data-testid="sessions">{String(context.hasPlatformSession)}:{String(context.hasVenueSession)}</dd>
    </dl>
  );
}

describe('AuthContext portal identity isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '#/guest-portal?couple=couple-1';
    mocks.restoreSupabaseSession.mockImplementation(async (_organizationId: unknown, surface: string) => (
      surface === 'platform'
        ? {
            user: { id: 'platform-user', name: 'Platform Owner', role: 'admin' },
            platformRole: 'platform_owner',
          }
        : {
            user: { id: 'venue-user', name: 'Venue Owner', role: 'admin' },
            organizationId: 'org-1',
            organizationSlug: 'seven-paths',
          }
    ));
  });

  it('preserves independent staff sessions without exposing either identity to a guest portal', async () => {
    render(<AuthProvider><ContextProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('sessions')).toHaveTextContent('true:true'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(screen.getByTestId('organization')).toHaveTextContent('none');
    expect(screen.getByTestId('platform-role')).toHaveTextContent('none');
    expect(mocks.setAuthSurface).toHaveBeenCalledWith('guest');
  });
});
