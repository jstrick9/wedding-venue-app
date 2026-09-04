import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const completeMock = vi.fn();

vi.mock('../services/backend/AuthBackend', () => ({
  completeSupabasePasswordRecovery: (...args: unknown[]) => completeMock(...args),
}));

vi.mock('../services/backend/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock('../services/platform/publicVenueService', () => ({
  getPublicVenueBranding: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/platform/organizationContext', () => ({
  getActiveOrganizationSlug: () => null,
}));

import PasswordRecoveryScreen from './PasswordRecoveryScreen';

describe('PasswordRecoveryScreen', () => {
  beforeEach(() => {
    completeMock.mockReset().mockResolvedValue(undefined);
    window.history.replaceState(null, '', '/reset/platform?code=pkce-code');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves the new password with the captured recovery code', async () => {
    render(<PasswordRecoveryScreen surface="platform" />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Newpass12!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Newpass12!' } });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));
    await waitFor(() => {
      expect(completeMock).toHaveBeenCalledTimes(1);
    });
    expect(completeMock.mock.calls[0][0]).toMatchObject({
      surface: 'platform',
      password: 'Newpass12!',
      code: 'pkce-code',
    });
  });

  it('refuses to save when the reset link has no recovery code', async () => {
    window.history.replaceState(null, '', '/reset/platform');
    render(<PasswordRecoveryScreen surface="platform" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/missing or incomplete/i);
    expect(screen.queryByRole('button', { name: /save new password/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to sign in/i })).toBeInTheDocument();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords without calling the recovery service', async () => {
    render(<PasswordRecoveryScreen surface="venue" />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Newpass12!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'otherpass' } });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('does not stay on Saving password when recovery never returns', async () => {
    completeMock.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    render(<PasswordRecoveryScreen surface="platform" />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Newpass12!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Newpass12!' } });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));
    expect(screen.getByRole('button', { name: /saving password/i })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(23000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/timed out/i);
    expect(screen.getByRole('button', { name: /save new password/i })).toBeEnabled();
  });

  it('retains captured recovery proof when Strict Mode replays effects', async () => {
    render(
      <StrictMode>
        <PasswordRecoveryScreen surface="platform" />
      </StrictMode>,
    );
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Newpass12!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Newpass12!' } });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));
    await waitFor(() => expect(completeMock).toHaveBeenCalledTimes(1));
    expect(completeMock.mock.calls[0][0]).toMatchObject({ code: 'pkce-code' });
  });

  it('accepts a direct recovery token, preserves venue return context, and strips secrets from the URL', async () => {
    window.history.replaceState(null, '', '/reset/venue#token_hash=token-hash-123&type=recovery&venue=hilltop-barn');
    render(<PasswordRecoveryScreen surface="venue" />);
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/reset/venue');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Newpass12!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Newpass12!' } });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));
    await waitFor(() => expect(completeMock).toHaveBeenCalledTimes(1));
    expect(completeMock.mock.calls[0][0]).toMatchObject({
      surface: 'venue',
      tokenHash: 'token-hash-123',
    });
  });

  it('never renders a raw infrastructure error', async () => {
    completeMock.mockRejectedValueOnce(new Error('Supabase database provider failed'));
    render(<PasswordRecoveryScreen surface="platform" />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Newpass12!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Newpass12!' } });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not save your new password right now/i);
    expect(alert).not.toHaveTextContent(/supabase|provider/i);
  });

});
