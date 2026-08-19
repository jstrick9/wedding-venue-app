import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const acceptInviteMock = vi.fn();
const refreshSessionMock = vi.fn();

vi.mock('../services/org/inviteService', () => ({
  acceptInvite: (...args: unknown[]) => acceptInviteMock(...args),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshSession: refreshSessionMock,
  }),
}));

vi.mock('../config', () => ({
  getConfig: () => ({
    primaryColor: '#4A1942',
    backgroundColor: '#f3f4f6',
  }),
}));

import { AcceptInvite } from './AcceptInvite';

describe('AcceptInvite', () => {
  beforeEach(() => {
    acceptInviteMock.mockReset();
    refreshSessionMock.mockReset();
    refreshSessionMock.mockResolvedValue(undefined);
  });

  it('refreshes the AuthContext session after a successful accept', async () => {
    acceptInviteMock.mockResolvedValue({ ok: true });
    const onDone = vi.fn();

    render(<AcceptInvite token="invite-token" onDone={onDone} />);

    await waitFor(() => {
      expect(acceptInviteMock).toHaveBeenCalledWith('invite-token');
    });
    await waitFor(() => {
      expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/you have joined the workspace/i)).toBeInTheDocument();
  });

  it('does not refresh the session when accept fails', async () => {
    acceptInviteMock.mockResolvedValue({ ok: false, error: 'Invite not found or already used.' });

    render(<AcceptInvite token="bad-token" onDone={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/invite not found/i)).toBeInTheDocument();
    });
    expect(refreshSessionMock).not.toHaveBeenCalled();
  });
});
