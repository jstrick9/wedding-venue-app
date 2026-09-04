import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  restore: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../services/backend/AuthBackend', () => ({
  shouldUseSupabaseAuth: () => true,
  restoreSupabaseSession: (...args: unknown[]) => mocks.restore(...args),
  signInWithSupabase: (...args: unknown[]) => mocks.signIn(...args),
  signOutSupabase: (...args: unknown[]) => mocks.signOut(...args),
  signUpOrganizationInvite: vi.fn(),
  signUpWithSupabase: vi.fn(),
}));

vi.mock('../services/backend/supabaseClient', () => ({
  migrateLegacyAuthSessions: () => Promise.resolve(),
  setAuthSurface: vi.fn(),
}));

vi.mock('../hooks/useLayoutState', () => ({
  getUsers: () => [],
  setUsers: vi.fn(),
}));

import { AuthProvider, useAuth } from './AuthContext';
import { AuthFlowError } from '../utils/authErrors';

function Probe() {
  const auth = useAuth();
  const [error, setError] = useState('');
  return (
    <div>
      <div data-testid="venue-user">{auth.user?.email || 'none'}</div>
      <div data-testid="venue-session">{String(auth.hasVenueSession)}</div>
      <div data-testid="login-error">{error}</div>
      <button
        type="button"
        onClick={() => {
          void auth.loginForOrganization('org-target', 'owner@example.com', 'secret')
            .catch((reason) => setError(reason instanceof Error ? reason.message : 'failed'));
        }}
      >
        Try target venue
      </button>
    </div>
  );
}

describe('AuthContext failed venue login isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '#/venue-login/target-venue';
    mocks.restore.mockImplementation(async (_organizationId: unknown, surface: string) => (
      surface === 'venue'
        ? {
            user: { id: 'old-user', email: 'old@example.com', name: 'Old Venue', role: 'admin' },
            organizationId: 'org-old',
            organizationSlug: 'old-venue',
          }
        : null
    ));
    mocks.signIn.mockRejectedValue(new AuthFlowError('venue_access_denied'));
  });

  it('clears the stale venue state instead of restoring an arbitrary membership', async () => {
    const user = userEvent.setup();
    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('venue-user')).toHaveTextContent('old@example.com'));
    expect(mocks.restore).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: /try target venue/i }));

    await waitFor(() => expect(screen.getByTestId('venue-user')).toHaveTextContent('none'));
    expect(screen.getByTestId('venue-session')).toHaveTextContent('false');
    expect(screen.getByTestId('login-error')).toHaveTextContent(/does not have access to this venue/i);
    expect(mocks.restore).toHaveBeenCalledTimes(2);
  });
});
