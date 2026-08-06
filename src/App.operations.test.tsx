import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

/**
 * Regression test: the Staff Operations panel was imported + the Header's
 * Operations button fired the modal, but the panel was never rendered in
 * AuthenticatedApp — clicking Operations did nothing. This verifies an admin
 * can open the panel.
 */
describe('App Staff Operations access', () => {
  it('renders the Staff Operations panel when an admin opens Operations', async () => {
    localStorage.clear();

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const admin = {
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

    localStorage.setItem('spm_users', JSON.stringify([admin]));
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

    // Admin sees the Operations button (in the sidebar nav and quick actions).
    const opsButton = (await screen.findAllByRole('button', { name: /operations/i }))[0];
    expect(opsButton).toBeInTheDocument();

    fireEvent.click(opsButton);

    // The panel must mount and show its header.
    expect(await screen.findByRole('heading', { name: /staff & operations/i })).toBeInTheDocument();
  });
});
