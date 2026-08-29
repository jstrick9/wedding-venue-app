import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn();
const sendMock = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'platform@example.com' }, organizationId: null }),
}));

vi.mock('../services/platform/platformChatService', () => ({
  listPlatformVenueMessages: (...args: unknown[]) => listMock(...args),
  savePlatformChatReadMarker: vi.fn(),
  sendPlatformVenueMessage: (...args: unknown[]) => sendMock(...args),
  subscribeToPlatformVenueMessages: () => () => {},
}));

import PlatformVenueChatPanel from './PlatformVenueChatPanel';

describe('PlatformVenueChatPanel', () => {
  beforeEach(() => {
    listMock.mockReset().mockResolvedValue([]);
    sendMock.mockReset().mockResolvedValue({
      id: 'm1',
      organizationId: 'org-1',
      senderSide: 'platform',
      body: 'hello',
      createdAt: '2026-08-28T00:00:00.000Z',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not stay on Sending when send never returns', async () => {
    sendMock.mockImplementation(() => new Promise(() => {}));
    render(<PlatformVenueChatPanel organizationId="org-1" organizationName="Hilltop Barn" senderSide="platform" />);
    expect(await screen.findByText(/no platform messages yet/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/platform chat with hilltop barn/i), { target: { value: 'Need a reissue' } });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(21000);
    });
    vi.useRealTimers();
    expect(screen.getByRole('alert')).toHaveTextContent(/timed out/i);
    expect(screen.getByRole('button', { name: /^send$/i })).toBeEnabled();
  });
});
