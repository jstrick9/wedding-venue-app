import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

describe('App password-recovery bootstrap', () => {
  beforeEach(() => {
    window.history.replaceState(
      null,
      '',
      '/reset/platform#token_hash=one-time-proof&type=recovery',
    );
  });

  it('handles recovery before the normal login/session provider and scrubs the proof', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /set a new password/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^sign in$/i })).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(window.location.pathname).toBe('/reset/platform');
  });
});
