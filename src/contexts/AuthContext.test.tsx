import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import type { User } from '../types';

let mockUsers: User[] = [];

vi.mock('../hooks/useLayoutState', () => ({
  getUsers: () => mockUsers,
  setUsers: (users: User[]) => {
    mockUsers = users;
  },
}));

function TestConsumer() {
  const { user, login, logout, continueAsGuest, createUser, updateUser, changePassword, refreshSession } = useAuth();

  return (
    <div>
      <div data-testid="current-user">{user?.name || 'none'}</div>

      <button type="button" onClick={() => void login('jane', 'secret')}>
        Login
      </button>

      <button type="button" onClick={() => void changePassword('u1', 'NewPass123!')}>
        Change Password
      </button>

      <button type="button" onClick={() => void login('jane', 'wrong-password')}>
        Login Wrong
      </button>

      <button type="button" onClick={continueAsGuest}>
        Guest
      </button>

      <button type="button" onClick={logout}>
        Logout
      </button>

      <button
        type="button"
        onClick={() => void createUser('newuser', 'Password123!', 'New User', 'basic')}
      >
        Create User
      </button>

      <button
        type="button"
        onClick={() =>
          updateUser('u1', {
            ...( { userStatus: 'suspended' } as Partial<User>),
          })
        }
      >
        Suspend User
      </button>

      <button
        type="button"
        onClick={() =>
          updateUser('u1', {
            name: 'Jane Updated',
          })
        }
      >
        Rename User
      </button>

      <button type="button" onClick={() => void refreshSession()}>
        Refresh Session
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUsers = [
      {
        id: 'u1',
        username: 'jane',
        password: 'secret',
        role: 'basic',
        name: 'Jane Doe',
        isActive: true,
        createdAt: new Date().toISOString(),
        ...( { sessionVersion: 1 } as Partial<User>),
      } as User,
    ];
  });

  it('restores a legacy session and upgrades it to v2', async () => {
    localStorage.setItem(
      'spm_session',
      JSON.stringify({
        userId: 'u1',
        expiry: Date.now() + 60_000,
        isGuest: false,
      }),
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-user')).toHaveTextContent('Jane Doe');
    });

    expect(localStorage.getItem('spm_session_v2')).toBeTruthy();
    expect(localStorage.getItem('spm_session')).toBeNull();
  });

  it('login saves a v2 session', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByTestId('current-user')).toHaveTextContent('Jane Doe');
    });

    const stored = JSON.parse(localStorage.getItem('spm_session_v2') || 'null');
    expect(stored.v).toBe(2);
    expect(stored.userId).toBe('u1');
    expect(mockUsers[0].password).toBe('');
    expect((mockUsers[0] as any).passwordHash).toBeTruthy();
    expect((mockUsers[0] as any).passwordSalt).toBeTruthy();
    expect((mockUsers[0] as any).passwordAlgorithm).toBe('pbkdf2-sha256');
    expect((mockUsers[0] as any).sessionVersion).toBe(2);
    expect(stored.sessionVersion).toBe(2);
  });

  it('failed login records a failedLoginCount', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Login Wrong' }));

    await waitFor(() => {
      expect((mockUsers[0] as any).failedLoginCount).toBe(1);
    });
  });

  it('continueAsGuest creates a guest session', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Guest' }));

    await waitFor(() => {
      expect(screen.getByTestId('current-user')).toHaveTextContent('Guest User');
    });

    const stored = JSON.parse(localStorage.getItem('spm_session_v2') || 'null');
    expect(stored.isGuest).toBe(true);
  });

  it('logout clears sessions', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => {
      expect(screen.getByTestId('current-user')).toHaveTextContent('Jane Doe');
    });

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(screen.getByTestId('current-user')).toHaveTextContent('none');
    });

    expect(localStorage.getItem('spm_session_v2')).toBeNull();
    expect(localStorage.getItem('spm_session')).toBeNull();
  });

  it('createUser stores a hashed-password user record', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Create User' }));

    await waitFor(() => {
      const created = mockUsers.find((u) => u.username === 'newuser') as any;
      expect(created).toBeTruthy();
      expect(created.password).toBe('');
      expect(created.passwordHash).toBeTruthy();
      expect(created.passwordSalt).toBeTruthy();
      expect(created.passwordAlgorithm).toBe('pbkdf2-sha256');
      expect(created.sessionVersion).toBe(1);
    });
  });

  it('changePassword hashes the new password and clears requiresPasswordChange', async () => {
    const user = userEvent.setup();

    // Simulate the default-admin state that must be remediated on first login.
    (mockUsers[0] as any).requiresPasswordChange = true;

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // Sign in as the user first (so the in-memory user updates too).
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => {
      expect(screen.getByTestId('current-user')).toHaveTextContent('Jane Doe');
    });

    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      const updated = mockUsers[0] as any;
      expect(updated.requiresPasswordChange).toBe(false);
      expect(updated.password).toBe('');
      expect(updated.passwordHash).toBeTruthy();
      expect(updated.passwordSalt).toBeTruthy();
      expect(updated.passwordAlgorithm).toBe('pbkdf2-sha256');
      expect(updated.sessionVersion).toBe(3);
    });

    // The in-memory session user reflects the cleared flag so the gate unmounts.
    expect(screen.getByTestId('current-user')).toHaveTextContent('Jane Doe');
  });

  it('bumps sessionVersion for auth-sensitive updates', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Suspend User' }));

    expect((mockUsers[0] as any).sessionVersion).toBe(2);
    expect((mockUsers[0] as any).userStatus).toBe('suspended');
  });

  it('refreshSession re-reads the local user after a rename', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => {
      expect(screen.getByTestId('current-user')).toHaveTextContent('Jane Doe');
    });

    mockUsers[0] = { ...mockUsers[0], name: 'Jane From Storage' };
    await user.click(screen.getByRole('button', { name: 'Refresh Session' }));

    await waitFor(() => {
      expect(screen.getByTestId('current-user')).toHaveTextContent('Jane From Storage');
    });
  });

  it('does not bump sessionVersion for non-auth-sensitive updates', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Rename User' }));

    expect((mockUsers[0] as any).sessionVersion).toBe(1);
    expect(mockUsers[0].name).toBe('Jane Updated');
  });
});