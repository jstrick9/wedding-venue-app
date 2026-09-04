import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gateProps = vi.hoisted(() => vi.fn());
const cloudPulls = vi.hoisted(() => ({
  couple: vi.fn(),
  guest: vi.fn(),
}));

vi.mock('../services/couples/coupleCloudSync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/couples/coupleCloudSync')>();
  return {
    ...actual,
    isCoupleCloudEnabled: () => true,
    pullCouplePortalSnapshot: cloudPulls.couple,
    pullGuestPortalSnapshot: cloudPulls.guest,
  };
});

vi.mock('./PortalInviteAccountSetup', () => ({
  PortalInviteAccountSetup: (props: {
    kind: 'couple' | 'guest';
    token: string;
    coupleId?: string;
    onAuthenticated: (context: unknown) => void;
  }) => {
    gateProps(props);
    return (
      <div>
        personal-account-gate-{props.kind}
        <button
          type="button"
          aria-label={`authenticate-${props.kind}`}
          onClick={() => props.onAuthenticated({
            kind: props.kind,
            organizationId: 'org-1',
            organizationName: 'Venue',
            organizationSlug: 'venue',
            coupleId: props.coupleId || 'couple-1',
            coupleName: 'Private Couple',
            participantType: props.kind === 'guest' ? 'guest' : 'couple',
            participantId: `${props.kind}-participant`,
            email: `${props.kind}@example.test`,
            fullName: 'Portal User',
            role: props.kind,
            accountRequired: true,
            accountClaimed: true,
            authenticated: true,
          })}
        >
          authenticate
        </button>
      </div>
    );
  },
}));

import { PortalAccessError } from '../services/couples/coupleCloudSync';
import CouplesPortal from './CouplesPortal';
import GuestPortal from './GuestPortal';

describe('personal portal account integration', () => {
  beforeEach(() => {
    gateProps.mockClear();
    cloudPulls.couple.mockReset().mockResolvedValue(null);
    cloudPulls.guest.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the account setup gate before a couple token can hydrate portal data', () => {
    render(
      <CouplesPortal
        coupleToken="cp-token-at-least-sixteen-characters"
        venueSlug="seven-paths"
        onExitPortal={() => undefined}
      />,
    );

    expect(screen.getByText('personal-account-gate-couple')).toBeInTheDocument();
    expect(screen.queryByText(/invitation not found/i)).not.toBeInTheDocument();
    expect(gateProps).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'couple',
      token: 'cp-token-at-least-sixteen-characters',
      venueSlug: 'seven-paths',
    }));
  });

  it('routes manual couple-token entry through the same account gate', () => {
    render(<CouplesPortal onExitPortal={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/invitation token/i), {
      target: { value: 'manual-couple-token-at-least-sixteen' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(screen.getByText('personal-account-gate-couple')).toBeInTheDocument();
    expect(gateProps).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'couple',
      token: 'manual-couple-token-at-least-sixteen',
    }));
  });

  it('shows the account setup gate before a cloud guest invitation can open an RSVP', () => {
    render(
      <GuestPortal
        guestToken="guest-token-at-least-sixteen-characters"
        coupleEventId="couple-1"
        venueSlug="seven-paths"
        onExitPortal={() => undefined}
      />,
    );

    expect(screen.getByText('personal-account-gate-guest')).toBeInTheDocument();
    expect(screen.queryByText(/access my portal/i)).not.toBeInTheDocument();
    expect(gateProps).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'guest',
      token: 'guest-token-at-least-sixteen-characters',
      coupleId: 'couple-1',
      venueSlug: 'seven-paths',
    }));
  });

  it('re-gates an already-open guest portal after an authoritative poll denial', async () => {
    vi.useFakeTimers();
    cloudPulls.guest
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new PortalAccessError('expired'));

    const view = render(
      <GuestPortal
        guestToken="guest-token-at-least-sixteen-characters"
        coupleEventId="couple-1"
        venueSlug="seven-paths"
        onExitPortal={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'authenticate-guest' }));
    await act(async () => { await Promise.resolve(); });
    expect(cloudPulls.guest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('personal-account-gate-guest')).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(cloudPulls.guest).toHaveBeenCalledTimes(2);
    expect(screen.getByText('personal-account-gate-guest')).toBeInTheDocument();
    view.unmount();
  });

  it('re-gates an already-open couple portal after an authoritative poll denial', async () => {
    vi.useFakeTimers();
    cloudPulls.couple
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new PortalAccessError('venue_unavailable'));

    const view = render(
      <CouplesPortal
        coupleToken="cp-token-at-least-sixteen-characters"
        venueSlug="seven-paths"
        onExitPortal={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'authenticate-couple' }));
    await act(async () => { await Promise.resolve(); });
    expect(cloudPulls.couple).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('personal-account-gate-couple')).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(cloudPulls.couple).toHaveBeenCalledTimes(2);
    expect(screen.getByText('personal-account-gate-couple')).toBeInTheDocument();
    view.unmount();
  });
});
