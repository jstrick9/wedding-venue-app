import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { changePassword } = vi.hoisted(() => ({
  changePassword: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      name: 'Ada Admin',
      username: 'ada',
      email: 'ada@hilltop.com',
      role: 'admin',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      password: '',
      requiresPasswordChange: true,
    },
    changePassword,
  }),
}));

vi.mock('../config', () => ({
  getConfig: () => ({
    venueName: 'Hilltop Barn',
    logoUrl: '',
    primaryColor: '#111827',
    primaryDark: '#030712',
    primaryLight: '#374151',
    headerTextColor: '#FFFFFF',
    bodyTextColor: '#374151',
    backgroundColor: '#F9FAFB',
    fontFamily: 'Inter, system-ui, sans-serif',
    headingFontFamily: 'Inter, system-ui, sans-serif',
  }),
}));

vi.mock('../utils/documentBranding', () => ({
  applyDocumentBranding: () => undefined,
}));

import ForcePasswordChange from './ForcePasswordChange';

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password1' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('button', { name: /update password/i }));
}

describe('ForcePasswordChange hang guards', () => {
  beforeEach(() => {
    changePassword.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not stay on Updating when changePassword never returns", async () => {
    changePassword.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    render(<ForcePasswordChange />);
    fillAndSubmit();
    expect(screen.getByRole('button', { name: /updating/i })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(21000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/timed out/i);
    expect(screen.getByRole('button', { name: /update password/i })).toBeEnabled();
  });

  it("clears Updating when changePassword throws", async () => {
    changePassword.mockRejectedValue(new Error('Auth service unavailable'));
    render(<ForcePasswordChange />);
    fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/auth service unavailable/i);
    expect(screen.getByRole('button', { name: /update password/i })).toBeEnabled();
  });
});
