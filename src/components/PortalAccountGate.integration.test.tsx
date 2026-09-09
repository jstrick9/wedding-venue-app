import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    localStorage.clear();
    sessionStorage.clear();
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

  it('opens a current invitation-scoped read-only snapshot and recovers when storage returns', async () => {
    vi.useFakeTimers();
    const inviteToken = 'cp-token-at-least-sixteen-characters';
    cloudPulls.couple.mockResolvedValue({
      updatedAt: '2026-09-06T12:00:00.000Z',
      payload: {
        coupleEvents: [{
          id: 'couple-1',
          coupleName: 'Private Couple',
          inviteToken,
          inviteExpiresAt: '2099-06-02T23:59:59.999Z',
          status: 'active',
          eventDate: '2027-06-01',
          availableSpaces: ['space-cloud'],
          selectedSpaces: ['space-cloud'],
          layoutStatus: 'none',
          layoutHistory: [],
          collaborators: [{
            id: 'couple-participant',
            name: 'Private Couple',
            email: 'couple@example.test',
            role: 'couple',
            inviteToken,
            inviteExpiresAt: '2099-06-02T23:59:59.999Z',
            accepted: true,
            invitedAt: '2026-09-06T12:00:00.000Z',
          }],
          createdAt: '2026-09-06T12:00:00.000Z',
          updatedAt: '2026-09-06T12:00:00.000Z',
        }],
        venues: [{
          id: 'space-cloud',
          name: 'Cloud Ballroom',
          width: 60,
          height: 40,
          capacity: 120,
          category: 'reception',
        }],
        venueRules: {
          rules: ['Couple guidance from this venue'],
          updatedAt: '2026-09-06T12:00:00.000Z',
        },
        coupleMessages: [{
          id: 'message-1',
          coupleEventId: 'couple-1',
          senderId: 'venue-user',
          senderName: 'Venue Team',
          senderSide: 'venue',
          message: 'Current invitation message',
          createdAt: '2026-09-06T12:00:00.000Z',
        }],
        venueMapConfigs: {
          width: 100,
          height: 80,
          points: [{ id: 'gate', label: 'Couple Quota-safe Gate', kind: 'entry', x: 10, y: 10 }],
          routes: [],
          drawings: [],
          rainContingencies: [],
          updatedAt: '2026-09-06T12:00:00.000Z',
        },
      },
    });

    const nativeSetItem = Storage.prototype.setItem;
    let storageBlocked = true;
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(this: Storage, key, value) {
      if (storageBlocked) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return nativeSetItem.call(this, key, value);
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = render(
      <CouplesPortal
        coupleToken={inviteToken}
        venueSlug="seven-paths"
        onExitPortal={() => undefined}
      />,
    );

    try {
      fireEvent.click(screen.getByRole('button', { name: 'authenticate-couple' }));
      await act(async () => { await Promise.resolve(); });
      expect(cloudPulls.couple).toHaveBeenCalled();
      expect(screen.getByRole('tab', { name: /venue spaces/i })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(/Secure read-only mode/i);
      fireEvent.click(screen.getByRole('tab', { name: /design & approval/i }));
      expect(screen.getByText('Couple guidance from this venue')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit All Layouts for Approval/i })).toBeDisabled();
      fireEvent.click(screen.getByRole('tab', { name: /venue spaces/i }));
      expect(screen.getAllByText(/Cloud Ballroom/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Couple Quota-safe Gate/).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('tab', { name: /chat/i }));
      expect(screen.getByText('Current invitation message')).toBeInTheDocument();
      expect(screen.getByLabelText('Chat message')).toBeDisabled();
      expect(screen.getByRole('button', { name: /Send/i })).toBeDisabled();

      storageBlocked = false;
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Chat message')).toBeEnabled();

      view.rerender(
        <CouplesPortal
          coupleToken="different-couple-token-at-least-sixteen"
          venueSlug="another-venue"
          onExitPortal={() => undefined}
        />,
      );
      expect(screen.getByText('personal-account-gate-couple')).toBeInTheDocument();
      expect(screen.queryByText(/Couple Quota-safe Gate/)).not.toBeInTheDocument();
      expect(gateProps).toHaveBeenLastCalledWith(expect.objectContaining({
        token: 'different-couple-token-at-least-sixteen',
        venueSlug: 'another-venue',
      }));
    } finally {
      view.unmount();
      storageSpy.mockRestore();
      consoleSpy.mockRestore();
    }
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

  it('re-renders an open guest map when a poll changes only the map payload', async () => {
    vi.useFakeTimers();
    const cloudSnapshot = (pointId: string, label: string) => ({
      coupleId: 'couple-1',
      event: [{
        id: 'couple-1',
        coupleName: 'Private Couple',
        eventDate: '2027-06-01',
        selectedSpaces: [],
        collaborators: [],
      }],
      venues: [],
      portalConfig: {
        'couple-1': {
          eventTitle: 'Private Couple',
          eventStartDate: '2027-06-01',
          showMap: true,
          showSchedule: false,
          showWayfinding: false,
          showRSVP: false,
          showLodging: false,
        },
      },
      venueMap: {
        width: 100,
        height: 80,
        points: [{ id: pointId, label, kind: 'entry', x: 10, y: 10 }],
        routes: [],
        drawings: [],
        rainContingencies: [],
        updatedAt: `2026-09-06T12:00:0${pointId === 'old' ? '0' : '5'}.000Z`,
      },
      guestEvents: [],
      guest: { id: 'guest-1', name: 'Portal Guest', allowPortalAccess: true },
      rsvp: null,
    });
    cloudPulls.guest
      .mockResolvedValueOnce(cloudSnapshot('old', 'Old Gate'))
      .mockResolvedValueOnce(cloudSnapshot('new', 'New Gate'));

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
    fireEvent.click(screen.getByRole('tab', { name: /venue map/i }));
    expect(screen.getAllByText(/Old Gate/).length).toBeGreaterThan(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getAllByText(/New Gate/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Old Gate/)).toHaveLength(0);
    view.unmount();
  });

  it('keeps authenticated guest map and guidance usable when browser persistence fails', async () => {
    localStorage.setItem('spm_venue_rules', JSON.stringify({
      version: 1,
      savedAt: '2026-09-01T00:00:00.000Z',
      data: { rules: ['Other venue private guidance'], updatedAt: '2026-09-01T00:00:00.000Z' },
    }));
    const firstSnapshot = {
      coupleId: 'couple-1',
      event: [{
        id: 'couple-1',
        coupleName: 'Private Couple',
        eventDate: '2027-06-01',
        selectedSpaces: [],
        collaborators: [],
      }],
      venues: [],
      portalConfig: {
        'couple-1': {
          eventTitle: 'Private Couple',
          eventStartDate: '2027-06-01',
          showMap: true,
          showSchedule: false,
          showWayfinding: false,
          showRSVP: false,
          showLodging: false,
        },
      },
      venueMap: {
        width: 100,
        height: 80,
        points: [{ id: 'gate', label: 'Quota-safe Gate', kind: 'entry', x: 10, y: 10 }],
        routes: [],
        drawings: [],
        rainContingencies: [],
        updatedAt: '2026-09-06T12:00:00.000Z',
      },
      venueRules: {
        rules: ['Current venue: use the east guest entrance'],
        updatedAt: '2026-09-06T12:00:00.000Z',
      },
      guestEvents: [],
      guest: { id: 'guest-1', name: 'Portal Guest', allowPortalAccess: true },
      rsvp: null,
    };
    cloudPulls.guest.mockImplementation(async (coupleId: string) => {
      if (coupleId === 'couple-1') return firstSnapshot;
      return {
        ...firstSnapshot,
        coupleId: 'couple-2',
        event: [{ ...firstSnapshot.event[0], id: 'couple-2', coupleName: 'Second Couple' }],
        portalConfig: {
          'couple-2': {
            ...firstSnapshot.portalConfig['couple-1'],
            eventTitle: 'Second Couple',
          },
        },
        venueMap: {
          ...firstSnapshot.venueMap,
          points: [{ id: 'second-gate', label: 'Second Venue Gate', kind: 'entry', x: 15, y: 15 }],
        },
        venueRules: undefined,
        guest: { id: 'guest-2', name: 'Second Guest', allowPortalAccess: true },
      };
    });

    const nativeSetItem = Storage.prototype.setItem;
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(this: Storage, key, value) {
      if (['spm_venue_map_configs', 'spm_venue_rules', 'spm_venue_weather', 'spm_portal_auth'].includes(key)) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return nativeSetItem.call(this, key, value);
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const view = render(
      <GuestPortal
        guestToken="guest-token-at-least-sixteen-characters"
        coupleEventId="couple-1"
        venueSlug="seven-paths"
        onExitPortal={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'authenticate-guest' }));
    await waitFor(() => expect(cloudPulls.guest).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('tab', { name: /venue map/i })).toBeInTheDocument());
    expect(screen.getByText('Current venue: use the east guest entrance')).toBeInTheDocument();
    expect(screen.queryByText('Other venue private guidance')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /venue map/i }));
    expect(screen.getAllByText(/Quota-safe Gate/).length).toBeGreaterThan(0);

    view.rerender(
      <GuestPortal
        guestToken="different-guest-token-at-least-sixteen"
        coupleEventId="couple-2"
        venueSlug="another-venue"
        onExitPortal={() => undefined}
      />,
    );
    expect(screen.getByText('personal-account-gate-guest')).toBeInTheDocument();
    expect(screen.queryByText(/Quota-safe Gate/)).not.toBeInTheDocument();
    expect(gateProps).toHaveBeenLastCalledWith(expect.objectContaining({
      token: 'different-guest-token-at-least-sixteen',
      coupleId: 'couple-2',
      venueSlug: 'another-venue',
    }));

    fireEvent.click(screen.getByRole('button', { name: 'authenticate-guest' }));
    await waitFor(() => expect(cloudPulls.guest).toHaveBeenCalledWith(
      'couple-2',
      'different-guest-token-at-least-sixteen',
      'another-venue',
    ));
    await waitFor(() => expect(screen.getByRole('tab', { name: /venue map/i })).toBeInTheDocument());
    expect(screen.queryByText('Current venue: use the east guest entrance')).not.toBeInTheDocument();
    expect(screen.queryByText('Other venue private guidance')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /venue map/i }));
    expect(screen.getAllByText(/Second Venue Gate/).length).toBeGreaterThan(0);

    view.unmount();
    storageSpy.mockRestore();
    consoleSpy.mockRestore();
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
