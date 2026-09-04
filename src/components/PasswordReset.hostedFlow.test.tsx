import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();

vi.mock('../services/backend/AuthBackend', () => ({
  shouldUseSupabaseAuth: () => true,
}));

vi.mock('../services/auth/passwordRecoveryService', () => ({
  requestPasswordReset: (...args: unknown[]) => requestMock(...args),
  describePasswordResetRequestError: () => 'Password reset is temporarily unavailable. Please try again later or contact support.',
}));

vi.mock('../config', () => ({
  getConfig: () => ({
    venueName: 'Hilltop Barn',
    primaryColor: '#111827',
    primaryDark: '#030712',
    headerTextColor: '#ffffff',
  }),
}));

import PasswordReset from './PasswordReset';

describe('PasswordReset hosted account flow', () => {
  beforeEach(() => {
    requestMock.mockReset().mockResolvedValue(undefined);
  });

  it('sends a tenant-scoped request and uses an account-enumeration-safe confirmation', async () => {
    const user = userEvent.setup();
    render(
      <PasswordReset
        authSurface="venue"
        organizationId="11111111-1111-4111-8111-111111111111"
        onClose={() => undefined}
        onSuccess={() => undefined}
      />,
    );

    await user.type(screen.getByLabelText(/email address/i), 'Owner@Example.com');
    await user.click(screen.getByRole('button', { name: /send password reset link/i }));

    expect(requestMock).toHaveBeenCalledWith({
      email: 'Owner@Example.com',
      surface: 'venue',
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
    expect(await screen.findByText(/if an account with access to this sign-in page matches/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/supabase|vercel|brevo|cloud mode|local mode/i);
  });

  it('shows a stable white-label failure while keeping the modal usable', async () => {
    requestMock.mockRejectedValueOnce(new Error('Supabase SMTP provider failed'));
    const user = userEvent.setup();
    render(
      <PasswordReset
        authSurface="platform"
        onClose={() => undefined}
        onSuccess={() => undefined}
      />,
    );

    await user.type(screen.getByLabelText(/email address/i), 'owner@example.com');
    await user.click(screen.getByRole('button', { name: /send password reset link/i }));

    const alert = await screen.findByText(/password reset is temporarily unavailable/i);
    expect(alert).not.toHaveTextContent(/supabase|smtp|provider/i);
    expect(screen.getByRole('button', { name: /send password reset link/i })).toBeEnabled();
  });
});
