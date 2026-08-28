import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const completeMock = vi.fn();

vi.mock('../services/backend/AuthBackend', () => ({
  completeSupabasePasswordRecovery: (...args: unknown[]) => completeMock(...args),
}));

vi.mock('../services/backend/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
}));

import PasswordRecoveryScreen from './PasswordRecoveryScreen';

describe('PasswordRecoveryScreen', () => {
  beforeEach(() => {
    completeMock.mockReset().mockResolvedValue(undefined);
    window.history.replaceState(null, '', '/reset/platform?code=pkce-code');
  });

  it('saves the new password with the captured recovery code', async () => {
    render(<PasswordRecoveryScreen surface="platform" />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Newpass12' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Newpass12' } });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));
    await waitFor(() => {
      expect(completeMock).toHaveBeenCalledTimes(1);
    });
    expect(completeMock.mock.calls[0][0]).toMatchObject({
      surface: 'platform',
      password: 'Newpass12',
      code: 'pkce-code',
    });
  });

  it('refuses to save when the reset link has no recovery code', async () => {
    window.history.replaceState(null, '', '/reset/platform');
    render(<PasswordRecoveryScreen surface="platform" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/missing or incomplete/i);
    expect(screen.queryByRole('button', { name: /save new password/i })).not.toBeInTheDocument();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords without calling the recovery service', async () => {
    render(<PasswordRecoveryScreen surface="venue" />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Newpass12' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'otherpass' } });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(completeMock).not.toHaveBeenCalled();
  });
});
