import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

/**
 * Security regression test: an authenticated user whose account still has
 * `requiresPasswordChange` must be blocked from the workspace and shown the
 * forced password-change gate (CRITICAL-2 fix).
 */
describe('App forced password-change gate', () => {
  it('blocks the workspace and shows the forced password-change screen when the user must change their password', async () => {
    localStorage.clear();

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const user = {
      id: 'u1',
      username: 'admin',
      password: '',
      role: 'admin',
      name: 'Administrator',
      email: 'weddings@sevenpathsmanor.com',
      isActive: true,
      requiresPasswordChange: true,
      sessionVersion: 1,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem('spm_users', JSON.stringify([user]));
    localStorage.setItem(
      'spm_session_v2',
      JSON.stringify({
        v: 2,
        userId: 'u1',
        issuedAt: new Date().toISOString(),
        expiresAt: future,
        isGuest: false,
        sessionVersion: 1,
      }),
    );

    render(<App />);

    // The gate must render instead of the planning workspace.
    expect(
      await screen.findByRole('heading', { name: /set a new password/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
  });

  it('renders the workspace when the user has already changed their password', async () => {
    localStorage.clear();

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const user = {
      id: 'u1',
      username: 'admin',
      password: '',
      role: 'admin',
      name: 'Administrator',
      email: 'weddings@sevenpathsmanor.com',
      isActive: true,
      requiresPasswordChange: false,
      sessionVersion: 1,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem('spm_users', JSON.stringify([user]));
    localStorage.setItem(
      'spm_session_v2',
      JSON.stringify({
        v: 2,
        userId: 'u1',
        issuedAt: new Date().toISOString(),
        expiresAt: future,
        isGuest: false,
        sessionVersion: 1,
      }),
    );

    render(<App />);

    // The forced-change gate must NOT appear for an already-remediated user.
    expect(
      screen.queryByRole('heading', { name: /set a new password/i }),
    ).not.toBeInTheDocument();
  });
});
