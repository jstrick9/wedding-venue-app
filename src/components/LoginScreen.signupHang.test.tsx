import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const onRegister = vi.fn();

vi.mock('../services/backend/AuthBackend', () => ({
  shouldUseSupabaseAuth: () => true,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    register: vi.fn(),
    continueAsGuest: vi.fn(),
  }),
}));

vi.mock('../config', () => ({
  applyRootStyles: () => undefined,
  getConfig: () => ({
    venueName: 'Hilltop Barn',
    tagline: '',
    location: '',
    websiteUrl: '',
    supportEmail: '',
    logoUrl: '',
    primaryColor: '#111827',
    primaryDark: '#030712',
    primaryLight: '#374151',
    accentColor: '#6B7280',
    backgroundColor: '#F9FAFB',
    textColor: '#111827',
    fontFamily: 'Inter, system-ui, sans-serif',
    headingFontFamily: 'Inter, system-ui, sans-serif',
    headerTextColor: '#FFFFFF',
    bodyTextColor: '#374151',
    accentTextColor: '#111827',
  }),
  useBrandingConfig: () => ({
    venueName: 'Hilltop Barn',
    tagline: '',
    location: '',
    websiteUrl: '',
    supportEmail: '',
    logoUrl: '',
    primaryColor: '#111827',
    primaryDark: '#030712',
    primaryLight: '#374151',
    accentColor: '#6B7280',
    backgroundColor: '#F9FAFB',
    textColor: '#111827',
    fontFamily: 'Inter, system-ui, sans-serif',
    headingFontFamily: 'Inter, system-ui, sans-serif',
    headerTextColor: '#FFFFFF',
    bodyTextColor: '#374151',
    accentTextColor: '#111827',
  }),
}));

import { LoginScreen } from './LoginScreen';

function fillAndSubmit() {
  fireEvent.click(screen.getByRole('button', { name: /create a new account/i }));
  fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Ada Admin' } });
  fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'ada@hilltop.com' } });
  fireEvent.change(screen.getByPlaceholderText('Password (min 8 chars)'), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
}

describe('LoginScreen invite sign-up hang guards', () => {
  beforeEach(() => {
    onRegister.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not stay on Creating account when register never returns", async () => {
    onRegister.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    render(
      <LoginScreen
        allowAccountCreation
        onRegister={onRegister}
        showPublicPortalLinks={false}
        loginScope="venue"
      />,
    );
    fillAndSubmit();
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(21000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/timed out/i);
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled();
  });

  it("clears Creating account when register throws", async () => {
    onRegister.mockRejectedValue(new Error('Auth service unavailable'));
    render(
      <LoginScreen
        allowAccountCreation
        onRegister={onRegister}
        showPublicPortalLinks={false}
        loginScope="venue"
      />,
    );
    fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/auth service unavailable/i);
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled();
  });
});
