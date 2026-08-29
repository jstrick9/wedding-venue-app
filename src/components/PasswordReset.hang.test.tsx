import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createSecretRecord } = vi.hoisted(() => ({
  createSecretRecord: vi.fn(),
}));

vi.mock('../config', () => ({
  getConfig: () => ({
    venueName: 'Seven Paths Manor',
  }),
}));

vi.mock('../hooks/useLayoutState', () => ({
  getUsers: () => [
    {
      id: 'u1',
      username: 'jane',
      email: 'jane@example.com',
      password: 'old-password',
      role: 'basic',
      name: 'Jane Doe',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  setUsers: () => undefined,
}));

vi.mock('../utils/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/auth')>();
  return {
    ...actual,
    createSecretRecord: (...args: unknown[]) => createSecretRecord(...args),
  };
});

import PasswordReset from './PasswordReset';

describe('PasswordReset local hang guards', () => {
  beforeEach(() => {
    createSecretRecord.mockReset();
    localStorage.clear();
  });

  it('does not stay on Sending Code when hashing throws', async () => {
    createSecretRecord.mockRejectedValue(new Error('Web Crypto API is not available in this environment.'));
    render(
      <PasswordReset
        onClose={() => undefined}
        onSuccess={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'jane' } });
    fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));
    expect(await screen.findByText(/web crypto api is not available/i)).toBeInTheDocument();
    expect(screen.queryByText('Sending Code...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send verification code/i })).not.toBeDisabled();
  });
});
