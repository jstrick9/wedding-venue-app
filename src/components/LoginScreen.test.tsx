import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogin = vi.fn();
const mockContinueAsGuest = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    continueAsGuest: mockContinueAsGuest,
  }),
}));

vi.mock('../config', () => ({
  applyRootStyles: () => undefined,
  getConfig: () => ({
    venueName: 'Seven Paths Manor',
    tagline: 'Where Your Love Story Unfolds',
    location: 'Spring Hope, NC',
    websiteUrl: 'https://www.sevenpathsmanor.com',
    supportEmail: 'events@sevenpathsmanor.com',
    logoUrl: '',
    primaryColor: '#4A1942',
    primaryDark: '#3d1a45',
    primaryLight: '#6b2c5c',
    accentColor: '#8B5A8B',
    backgroundColor: '#f3f4f6',
    textColor: '#1f2937',
    fontFamily: 'Inter, system-ui, sans-serif',
    headingFontFamily: 'Inter, system-ui, sans-serif',
    headerTextColor: '#FFFFFF',
    bodyTextColor: '#374151',
    accentTextColor: '#4A1942',
  }),
  useBrandingConfig: () => ({
    venueName: 'Seven Paths Manor',
    tagline: 'Where Your Love Story Unfolds',
    location: 'Spring Hope, NC',
    websiteUrl: 'https://www.sevenpathsmanor.com',
    supportEmail: 'events@sevenpathsmanor.com',
    logoUrl: '',
    primaryColor: '#4A1942',
    primaryDark: '#3d1a45',
    primaryLight: '#6b2c5c',
    accentColor: '#8B5A8B',
    backgroundColor: '#f3f4f6',
    textColor: '#1f2937',
    fontFamily: 'Inter, system-ui, sans-serif',
    headingFontFamily: 'Inter, system-ui, sans-serif',
    headerTextColor: '#FFFFFF',
    bodyTextColor: '#374151',
    accentTextColor: '#4A1942',
  }),
}));

vi.mock('./PasswordReset', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div>
      <div>Password Reset Modal</div>
      <button type="button" onClick={onClose}>
        Close Reset
      </button>
    </div>
  ),
}));

import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.location.hash = '';
  });

  it('loads remembered username on mount', async () => {
    localStorage.setItem('spm_remembered_user', 'remembered-user');

    render(<LoginScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^username$/i)).toHaveValue('remembered-user');
    });
  });

  it('submits login and stores remembered username when checked', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(true);

    render(<LoginScreen />);

    await user.type(screen.getByLabelText(/^username$/i), 'jane');
    await user.type(screen.getByLabelText(/^password$/i), 'secret');
    await user.click(screen.getByLabelText(/remember me/i));
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('jane', 'secret');
    });

    expect(localStorage.getItem('spm_remembered_user')).toBe('jane');
  });

  it('shows an error message when login fails', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(false);

    render(<LoginScreen />);

    await user.type(screen.getByLabelText(/^username$/i), 'jane');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /invalid username or password/i,
    );
  });

  it('uses onContinueAsGuest prop when provided', async () => {
    const user = userEvent.setup();
    const onContinueAsGuest = vi.fn();

    render(<LoginScreen onContinueAsGuest={onContinueAsGuest} />);

    await user.click(screen.getByRole('button', { name: /continue as planner guest/i }));

    expect(onContinueAsGuest).toHaveBeenCalledTimes(1);
    expect(mockContinueAsGuest).not.toHaveBeenCalled();
  });

  it('falls back to auth continueAsGuest when no prop is provided', async () => {
    const user = userEvent.setup();

    render(<LoginScreen />);

    await user.click(screen.getByRole('button', { name: /continue as planner guest/i }));

    expect(mockContinueAsGuest).toHaveBeenCalledTimes(1);
  });

  it('opens password reset modal', async () => {
    const user = userEvent.setup();

    render(<LoginScreen />);

    await user.click(screen.getByRole('button', { name: /forgot password/i }));

    expect(screen.getByText('Password Reset Modal')).toBeInTheDocument();
  });

  it('keeps the or divider when public portal links are shown', () => {
    render(<LoginScreen />);
    expect(screen.getByText(/^or$/i)).toBeInTheDocument();
  });

  it('navigates to the wedding guest portal', async () => {
    const user = userEvent.setup();

    render(<LoginScreen />);

    await user.click(screen.getByRole('button', { name: /open wedding guest portal/i }));

    expect(window.location.hash).toBe('#/guest-portal');
  });

  it('styles username/password inputs on focus and Open Guest Portal button with brand primary color', async () => {
    render(<LoginScreen />);

    const usernameInput = screen.getByPlaceholderText('Enter username') as HTMLInputElement;
    fireEvent.focus(usernameInput);
    expect(usernameInput.style.borderColor).toBe('rgb(74, 25, 66)');
    expect(usernameInput.style.boxShadow).toContain('0 0 0 3px');

    const guestPortalBtn = screen.getByRole('button', { name: /open wedding guest portal/i });
    expect(guestPortalBtn.style.color).toBe('rgb(74, 25, 66)');
  });

  it('uses brandingOverride chrome instead of the Seven Paths plum fallback', () => {
    render(
      <LoginScreen
        brandingOverride={{
          venueName: 'Platform Console',
          tagline: 'Admin',
          location: '',
          websiteUrl: '',
          supportEmail: '',
          primaryColor: '#26354A',
          primaryDark: '#182436',
          primaryLight: '#3E5875',
          accentColor: '#6B8DB3',
          backgroundColor: '#F4F7FA',
          textColor: '#1F2937',
          headerTextColor: '#FFFFFF',
          bodyTextColor: '#334155',
          accentTextColor: '#26354A',
          fontFamily: 'Inter, system-ui, sans-serif',
          headingFontFamily: 'Inter, system-ui, sans-serif',
        }}
        showPublicPortalLinks={false}
        loginScope="platform"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Platform Console' })).toBeInTheDocument();
    const signIn = screen.getByRole('button', { name: /sign in/i });
    expect(signIn).toHaveStyle({ backgroundColor: 'rgb(38, 53, 74)' });
    expect(signIn).not.toHaveStyle({ backgroundColor: 'rgb(74, 25, 66)' });
    expect(screen.queryByText(/^or$/i)).not.toBeInTheDocument();
  });

  it('hides the or divider on venue staff login', () => {
    render(
      <LoginScreen
        brandingOverride={{
          venueName: 'Hilltop Barn',
          tagline: '',
          location: '',
          websiteUrl: '',
          supportEmail: '',
          primaryColor: '#111827',
          primaryDark: '#030712',
          primaryLight: '#374151',
          accentColor: '#6B7280',
          backgroundColor: '#F9FAFB',
          textColor: '#111827',
          headerTextColor: '#FFFFFF',
          bodyTextColor: '#374151',
          accentTextColor: '#111827',
          fontFamily: 'Inter, system-ui, sans-serif',
          headingFontFamily: 'Inter, system-ui, sans-serif',
        }}
        showPublicPortalLinks={false}
        loginScope="venue"
      />,
    );

    expect(screen.queryByText(/^or$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue as planner guest/i })).not.toBeInTheDocument();
  });
});