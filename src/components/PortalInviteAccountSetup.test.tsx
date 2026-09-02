import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../types';
import type { PortalInviteContext } from '../services/portal/portalInviteAccount';
import { PortalInviteAccountSetup } from './PortalInviteAccountSetup';

const lookupPortalInviteContext = vi.fn();
const claimOrSignInPortalInvite = vi.fn();

vi.mock('../services/portal/portalInviteAccount', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/portal/portalInviteAccount')>();
  return {
    ...actual,
    lookupPortalInviteContext: (...args: unknown[]) => lookupPortalInviteContext(...args),
    claimOrSignInPortalInvite: (...args: unknown[]) => claimOrSignInPortalInvite(...args),
  };
});

const branding = {
  venueName: 'Seven Paths Manor',
  primaryColor: '#4A1942',
} as Config;

const inviteContext: PortalInviteContext = {
  kind: 'guest',
  organizationId: 'org-1',
  organizationName: 'Seven Paths Manor',
  organizationSlug: 'seven-paths',
  coupleId: 'couple-1',
  coupleName: 'Alex & Morgan',
  participantType: 'guest',
  participantId: 'guest-1',
  email: 'guest@example.com',
  fullName: 'Taylor Guest',
  role: 'guest',
  accountRequired: true,
  accountClaimed: false,
  authenticated: false,
};

function renderSetup(overrides: Partial<React.ComponentProps<typeof PortalInviteAccountSetup>> = {}) {
  const props: React.ComponentProps<typeof PortalInviteAccountSetup> = {
    kind: 'guest',
    token: 'guest-token-at-least-sixteen',
    coupleId: 'couple-1',
    venueSlug: 'seven-paths',
    branding,
    onAuthenticated: vi.fn(),
    onLegacyInvite: vi.fn(),
    onExit: vi.fn(),
    ...overrides,
  };
  render(<PortalInviteAccountSetup {...props} />);
  return props;
}

describe('PortalInviteAccountSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupPortalInviteContext.mockResolvedValue({ available: true, context: inviteContext });
    claimOrSignInPortalInvite.mockResolvedValue({ ...inviteContext, authenticated: true, accountClaimed: true });
  });

  it('uses the fixed invited email and requires a matching strong personal password', async () => {
    const user = userEvent.setup();
    const props = renderSetup();

    expect(await screen.findByRole('heading', { name: /create your account for alex & morgan/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/invited email address/i)).toHaveValue('guest@example.com');
    expect(screen.getByLabelText(/invited email address/i)).toHaveAttribute('readonly');
    const submit = screen.getByRole('button', { name: /create account & continue/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/^new password$/i), 'Strong#9');
    await user.type(screen.getByLabelText(/^confirm new password$/i), 'Strong#8');
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(submit).toBeDisabled();
    await user.clear(screen.getByLabelText(/^confirm new password$/i));
    await user.type(screen.getByLabelText(/^confirm new password$/i), 'Strong#9');
    expect(screen.getByText(/passwords match/i)).toBeInTheDocument();

    await user.click(submit);
    await waitFor(() => expect(claimOrSignInPortalInvite).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'guest',
      token: 'guest-token-at-least-sixteen',
      coupleId: 'couple-1',
      venueSlug: 'seven-paths',
      email: 'guest@example.com',
      password: 'Strong#9',
      mode: 'create',
    })));
    expect(props.onAuthenticated).toHaveBeenCalledWith(expect.objectContaining({ authenticated: true }));
  });

  it('requires an existing invitee to sign in without offering a password reset', async () => {
    const user = userEvent.setup();
    lookupPortalInviteContext.mockResolvedValue({
      available: true,
      context: { ...inviteContext, accountClaimed: true },
    });
    renderSetup();

    expect(await screen.findByRole('heading', { name: /sign in for alex & morgan/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm new password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/need a new account/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/^password$/i), 'Existing password');
    await user.click(screen.getByRole('button', { name: /sign in & continue/i }));

    await waitFor(() => expect(claimOrSignInPortalInvite).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'sign-in',
      email: 'guest@example.com',
      password: 'Existing password',
    })));
  });

  it('falls back only when the coordinated account migration is unavailable', async () => {
    lookupPortalInviteContext.mockResolvedValue({ available: false, context: null });
    const props = renderSetup();
    await waitFor(() => expect(props.onLegacyInvite).toHaveBeenCalledTimes(1));
    expect(props.onAuthenticated).not.toHaveBeenCalled();
  });

  it('continues immediately when this isolated portal session already owns the invite', async () => {
    lookupPortalInviteContext.mockResolvedValue({
      available: true,
      context: { ...inviteContext, accountClaimed: true, authenticated: true },
    });
    const props = renderSetup();
    await waitFor(() => expect(props.onAuthenticated).toHaveBeenCalledWith(expect.objectContaining({
      authenticated: true,
      participantId: 'guest-1',
    })));
  });
});
