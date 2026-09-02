import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const gateProps = vi.hoisted(() => vi.fn());

vi.mock('../services/couples/coupleCloudSync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/couples/coupleCloudSync')>();
  return {
    ...actual,
    isCoupleCloudEnabled: () => true,
    pullCouplePortalSnapshot: vi.fn(),
    pullGuestPortalSnapshot: vi.fn(),
  };
});

vi.mock('./PortalInviteAccountSetup', () => ({
  PortalInviteAccountSetup: (props: { kind: string; token: string; coupleId?: string }) => {
    gateProps(props);
    return <div>personal-account-gate-{props.kind}</div>;
  },
}));

import CouplesPortal from './CouplesPortal';
import GuestPortal from './GuestPortal';

describe('personal portal account integration', () => {
  beforeEach(() => gateProps.mockClear());

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
});
