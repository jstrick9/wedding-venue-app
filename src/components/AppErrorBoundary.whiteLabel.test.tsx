import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function Crash(): never {
  throw new Error('Supabase database credential failed at https://secret.example/reset?token=proof');
}

describe('AppErrorBoundary white-label output', () => {
  it('logs but never renders raw runtime details', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <Crash />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: /application recovery/i })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/supabase|database credential|secret\.example|token=proof/i);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
