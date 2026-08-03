import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform', () => ({
  getPlatformProvider: () => 'supabase',
}));

const rpc = vi.fn();
vi.mock('../backend/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({ rpc }),
}));

let portalGuests: any[] = [];
vi.mock('../../utils/guestPortal', () => ({
  getPortalGuestsForEvent: () => portalGuests,
  findGuestInEvent: () => undefined,
  getPortalRSVPSubmissions: () => [],
  setPortalRSVPSubmissions: () => {},
}));

import { SupabaseGuestPortalBackend } from './guestPortalBackend';

describe('SupabaseGuestPortalBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    portalGuests = [];
  });

  it('findGuest resolves via the get_guest_by_portal_token RPC', async () => {
    rpc.mockResolvedValue({
      data: {
        ok: true,
        guest: { id: 'g1', full_name: 'Jane', email: 'jane@x.com', table_assignment: 'T1', room_assignment: null, portal_access: { enabled: true } },
      },
      error: null,
    });

    const backend = new SupabaseGuestPortalBackend();
    const guest = await backend.findGuest({ eventName: 'Wed' }, 'portal-token-123');

    expect(rpc).toHaveBeenCalledWith('get_guest_by_portal_token', { p_token: 'portal-token-123' });
    expect(guest?.id).toBe('g1');
    expect(guest?.name).toBe('Jane');
    expect(guest?.tableId).toBe('T1');
  });

  it('submitRSVP calls the submit_guest_rsvp RPC with the token', async () => {
    rpc.mockResolvedValue({ data: { ok: true, submission_id: 'r1' }, error: null });
    const backend = new SupabaseGuestPortalBackend();

    const ok = await backend.submitRSVP(
      { eventName: 'Wed' },
      {
        id: 'r1', guestId: 'g1', fullName: 'Jane', email: 'jane@x.com',
        attending: true, submittedAt: 'now', token: 'portal-token-123',
      },
    );

    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith('submit_guest_rsvp', expect.objectContaining({
      p_token: 'portal-token-123',
      p_attending: true,
      p_full_name: 'Jane',
    }));
  });

  it('submitRSVP falls back to local when there is no token', async () => {
    const backend = new SupabaseGuestPortalBackend();
    const ok = await backend.submitRSVP(
      { eventName: 'Wed' },
      { id: 'r1', guestId: 'g1', fullName: 'Jane', email: 'jane@x.com', attending: true, submittedAt: 'now' },
    );
    // Without a token we fall back to local persistence (still returns true).
    expect(ok).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
});
