import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createInvite } = vi.hoisted(() => ({
  createInvite: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    organizationId: 'org1',
    isAdmin: true,
  }),
}));

vi.mock('../../config', () => ({
  getConfig: () => ({
    venueName: 'Hilltop Barn',
    primaryColor: '#111827',
  }),
}));

vi.mock('../Toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../services/org/inviteService', () => ({
  createInvite,
}));

import { InviteMembers } from './InviteMembers';
import { showToast } from '../Toast';

function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText('teammate@example.com'), {
    target: { value: 'ada@hilltop.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: /send invite/i }));
}

describe('InviteMembers hang guards', () => {
  beforeEach(() => {
    createInvite.mockReset();
    vi.mocked(showToast).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not stay on Sending invite when createInvite never returns", async () => {
    createInvite.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    render(<InviteMembers />);
    fillAndSubmit();
    expect(screen.getByRole('button', { name: /sending invite/i })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(21000);
    });
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/timed out/i), 'warning');
    expect(screen.getByRole('button', { name: /send invite/i })).toBeEnabled();
  });

  it("clears Sending invite when createInvite throws", async () => {
    createInvite.mockRejectedValue(new Error('Auth service unavailable'));
    render(<InviteMembers />);
    fillAndSubmit();
    await act(async () => {});
    expect(showToast).toHaveBeenCalledWith('Auth service unavailable', 'warning');
    expect(screen.getByRole('button', { name: /send invite/i })).toBeEnabled();
  });
});
