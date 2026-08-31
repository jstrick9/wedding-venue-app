import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
}));

import { CLAIM_FUNCTION_MISSING, claimVenueAdminAccount } from './claimVenueAdminAccount';

describe('claimVenueAdminAccount', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('posts the invite token and new password and returns the invited email', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        email: 'stricklandjoshua01@gmail.com',
        existingUser: true,
        claimed: true,
        organizationId: 'org-1',
        organizationName: 'Seven Paths Manor',
        organizationSlug: 'seven-paths-manor',
      }),
    } as Response);

    const result = await claimVenueAdminAccount({
      token: 'va-abc123def4567890',
      password: 'new-pass-123',
      fullName: 'Joshua Strickland',
    });

    expect(result.email).toBe('stricklandjoshua01@gmail.com');
    expect(result.existingUser).toBe(true);
    expect(result.claimed).toBe(true);
    expect(result.organizationSlug).toBe('seven-paths-manor');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/functions/v1/claim-venue-admin');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      token: 'va-abc123def4567890',
      password: 'new-pass-123',
      fullName: 'Joshua Strickland',
    });
  });

  it('defaults claimed to false when the Edge Function predates 0017', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        email: 'stricklandjoshua01@gmail.com',
        existingUser: true,
        organizationId: 'org-1',
        organizationName: 'Seven Paths Manor',
        organizationSlug: 'seven-paths-manor',
      }),
    } as Response);

    const result = await claimVenueAdminAccount({
      token: 'va-abc123def4567890',
      password: 'new-pass-123',
      fullName: 'Joshua Strickland',
    });

    expect(result.claimed).toBe(false);
  });

  it('explains a missing Edge Function so a reissue can still keep venue work', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Requested function was not found' }),
    } as Response);

    await expect(claimVenueAdminAccount({
      token: 'va-abc123def4567890',
      password: 'new-pass-123',
      fullName: 'Joshua Strickland',
    })).rejects.toThrow(CLAIM_FUNCTION_MISSING);
  });
});
